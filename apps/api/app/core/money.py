"""Money text for people. Amounts are integer paise everywhere else."""


def _indian(n: int) -> str:
    s = str(n)
    if len(s) <= 3:
        return s
    head, tail = s[:-3], s[-3:]
    parts = []
    while len(head) > 2:
        parts.insert(0, head[-2:])
        head = head[:-2]
    if head:
        parts.insert(0, head)
    return ",".join(parts + [tail])


def rupees(paise: int) -> str:
    """12345050 -> '₹1,23,450.50'; whole rupees show no decimals: 500000 -> '₹5,000'."""
    sign = "-" if paise < 0 else ""
    r, ps = divmod(abs(paise), 100)
    return f"{sign}₹{_indian(r)}" + (f".{ps:02d}" if ps else "")
