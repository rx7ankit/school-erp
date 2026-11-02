import uuid

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, parent_child, request_actor, require_parent, require_permission
from app.core.clock import today_ist
from app.core.errors import NotFound
from app.core.principal import Principal
from app.models.enums import AuditCategory, Permission
from app.models.library import LibraryCopy
from app.models.student import Student
from app.schemas.common import Page
from app.schemas.library import (
    BookDetail,
    BookIn,
    BookOut,
    BookPatch,
    CopiesIn,
    CopyOut,
    CopyStatusPatch,
    IssueIn,
    LoanFilter,
    LoanOut,
    ParentLibrary,
    ReturnIn,
    SettingsIn,
)
from app.services import library as svc
from app.services.audit import log_audit
from app.services.sheets import XLSX, build_xlsx

router = APIRouter(tags=["library"])
manage = require_permission(Permission.library.value)


# ------------------------------------------------------------------ settings
@router.get("/library/settings", response_model=SettingsIn)
async def get_settings(p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)):
    """Default loan days (14) and the fine per overdue day in paise (0 = no fine)."""
    return await svc.get_settings(db)


@router.put("/library/settings", response_model=SettingsIn)
async def put_settings(
    body: SettingsIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    return await svc.save_settings(db, request_actor(p, request), body)


# ------------------------------------------------------------------ books
@router.get("/library/books", response_model=Page[BookOut])
async def list_books(
    q: str | None = Query(None, description="title, author, ISBN or category"),
    category: str | None = None,
    available_only: bool = False,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    stmt = svc.books_query(q, category, available_only)
    total = await db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = (await db.execute(stmt.limit(limit).offset(offset))).all()
    return Page(items=[svc.book_out(r) for r in rows], total=total)


@router.post("/library/books", response_model=BookDetail, status_code=201)
async def create_book(
    body: BookIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    """`copies` creates that many copies with automatic accession numbers."""
    book = await svc.create_book(db, request_actor(p, request), body)
    return BookDetail(
        **(await svc.book_with_counts(db, book.id)).model_dump(), copies=await svc.book_copies(db, book.id)
    )


@router.get("/library/books/{book_id}", response_model=BookDetail)
async def get_book(book_id: uuid.UUID, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)):
    await svc.get_book_or_404(db, book_id)
    return BookDetail(
        **(await svc.book_with_counts(db, book_id)).model_dump(), copies=await svc.book_copies(db, book_id)
    )


@router.patch("/library/books/{book_id}", response_model=BookOut)
async def patch_book(
    book_id: uuid.UUID, body: BookPatch, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    await svc.update_book(db, await svc.get_book_or_404(db, book_id), body)
    return await svc.book_with_counts(db, book_id)


@router.delete("/library/books/{book_id}", status_code=204)
async def delete_book(book_id: uuid.UUID, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)):
    """Only a book with no copies can be deleted (409 `has_copies`)."""
    await svc.delete_book(db, await svc.get_book_or_404(db, book_id))
    return Response(status_code=204)


@router.post("/library/books/{book_id}/copies", response_model=list[CopyOut], status_code=201)
async def add_copies(
    book_id: uuid.UUID,
    body: CopiesIn,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """Adds `count` copies with the next accession numbers (`LIB-00001`...), or one copy with your own number."""
    book = await svc.get_book_or_404(db, book_id)
    made = await svc.add_copies(db, request_actor(p, request), book, body.count, body.accession_no)
    ids = {c.id for c in made}
    return [c for c in await svc.book_copies(db, book_id) if c.id in ids]


@router.get("/library/copies/lookup", response_model=CopyOut)
async def lookup_copy(accession_no: str, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)):
    c = await db.scalar(select(LibraryCopy).where(LibraryCopy.accession_no == accession_no.strip()))
    if c is None:
        raise NotFound("No copy with that accession number.")
    return await svc.copy_out(db, c.id)


@router.patch("/library/copies/{copy_id}", response_model=CopyOut)
async def patch_copy(
    copy_id: uuid.UUID,
    body: CopyStatusPatch,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """Mark a shelf copy `lost`, `damaged` or `available` again (audited). A copy on loan is returned instead."""
    copy = await svc.get_copy_or_404(db, copy_id)
    await svc.set_copy_status(db, request_actor(p, request), copy, body.status)
    return await svc.copy_out(db, copy_id)


# ------------------------------------------------------------------ loans
def _stmt(status, student_id, staff_id, book_id, q):
    return svc.loans_query(status=status, student_id=student_id, staff_id=staff_id, book_id=book_id, q=q)


@router.get("/library/loans", response_model=Page[LoanOut])
async def list_loans(
    status: LoanFilter = "open",
    student_id: uuid.UUID | None = None,
    staff_id: uuid.UUID | None = None,
    book_id: uuid.UUID | None = None,
    q: str | None = Query(None, description="title, author, accession no, student or staff name, scholar no"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """The borrowing history of a student or staff member is this list with `student_id=` or `staff_id=` and
    `status=all`. Open loans come oldest due date first; closed ones newest first."""
    items, total = await svc.list_loans(db, _stmt(status, student_id, staff_id, book_id, q), limit, offset)
    return Page(items=items, total=total)


@router.get("/library/overdue", response_model=Page[LoanOut])
async def overdue(
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """Open loans past their due date (IST), with days late and the fine accrued so far."""
    items, total = await svc.list_loans(db, _stmt("overdue", None, None, None, None), limit, offset)
    return Page(items=items, total=total)


@router.post("/library/loans", response_model=LoanOut, status_code=201)
async def issue(
    body: IssueIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    """Issue a copy (`copy_id` or `accession_no`) to a `student_id` or a `staff_id`. Due date defaults to today plus
    the school's loan days."""
    loan = await svc.issue(db, request_actor(p, request), body)
    return await svc.loan_view(db, loan.id)


@router.post("/library/loans/{loan_id}/return", response_model=LoanOut)
async def return_loan(
    loan_id: uuid.UUID,
    request: Request,
    body: ReturnIn | None = None,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """Return a copy: `condition` good, damaged or lost. The fine is days late (IST) x the per-day fine, unless you
    override `fine_paise`; `waive_fine` with a reason clears it (audited)."""
    await svc.return_loan(db, request_actor(p, request), loan_id, body or ReturnIn())
    return await svc.loan_view(db, loan_id)


@router.post("/library/loans/{loan_id}/renew", response_model=LoanOut)
async def renew(
    loan_id: uuid.UUID, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    """Extends the due date by the loan days. Not when overdue (`overdue`), at most twice (`renewal_limit`)."""
    await svc.renew(db, request_actor(p, request), loan_id)
    return await svc.loan_view(db, loan_id)


@router.get("/library/export")
async def export(
    request: Request,
    status: LoanFilter = "all",
    student_id: uuid.UUID | None = None,
    staff_id: uuid.UUID | None = None,
    book_id: uuid.UUID | None = None,
    q: str | None = None,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """Excel with a Books sheet (counts per book, filtered by `q`) and a Loans sheet (filtered like the loan list).
    Audited under exports."""
    books, loans = await svc.export_rows(
        db, books=svc.books_query(q, None, False), loans=_stmt(status, student_id, staff_id, book_id, q)
    )
    content = build_xlsx(
        [("Books", svc.BOOK_HEADERS, books), ("Loans", svc.LOAN_HEADERS, loans)],
    )
    log_audit(
        db,
        request_actor(p, request),
        AuditCategory.exports,
        "library.exported",
        f"Exported {len(books)} books and {len(loans)} loans to Excel (loans: {status})",
        entity_label="Library",
        sensitive=True,
    )
    return Response(
        content,
        media_type=XLSX,
        headers={"Content-Disposition": f'attachment; filename="library-{today_ist().isoformat()}.xlsx"'},
    )


# ------------------------------------------------------------------ parents
@router.get("/parent/children/{student_id}/library", response_model=ParentLibrary)
async def child_library(
    s: Student = Depends(parent_child), p: Principal = Depends(require_parent), db: AsyncSession = Depends(db_session)
):
    """Books the child has now, with due dates and an overdue flag. A child who has left stays visible."""
    current, n = await svc.child_library(db, s.id)
    return ParentLibrary(student_id=s.id, current=current, overdue_count=n)
