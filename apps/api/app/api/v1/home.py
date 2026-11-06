"""The staff Home layout: which tabs, menu entries and Home blocks a person gets, from their permissions."""

from fastapi import APIRouter, Depends

from app.api.deps import require_staff
from app.core.principal import Principal
from app.models.enums import Permission
from app.schemas.home import HomeLayout

router = APIRouter(prefix="/home", tags=["home"])


def layout_for(p: Principal) -> HomeLayout:
    academic, fees, people = (
        p.has(Permission.academic.value),
        p.has(Permission.fees.value),
        p.has(Permission.people.value),
    )
    tabs = ["home", "messages"]
    blocks = ["my_day", "my_classes", "notices"]
    menu: list[str] = []
    for on, name in ((academic, "academic"), (fees, "fees")):
        if on:
            tabs.append(name)
            blocks.append(name)
    if people:
        menu.append("people")
        blocks.append("people")
    return HomeLayout(tabs=tabs, menu=menu, blocks=blocks, has_assignments=bool(p.assignments))


@router.get("/layout", response_model=HomeLayout)
async def home_layout(p: Principal = Depends(require_staff)):
    return layout_for(p)
