from pydantic import BaseModel


class HomeLayout(BaseModel):
    """What this person's app shows, decided by the server from their permissions and assignments.

    - `tabs`: the bottom bar or sidebar, in order. `home` and `messages` are always there; `academic` and `fees`
      appear only with that permission.
    - `menu`: extra entries tucked into the profile menu (`people` for whoever manages people and access).
    - `blocks`: the cards on Home, in order. `notices`, `my_day` and `my_classes` are for everyone; `academic`,
      `fees` and `people` only with that permission.
    Apps draw the types they know and skip the rest, so a new block needs no app release.
    """

    tabs: list[str]
    menu: list[str]
    blocks: list[str]
    has_assignments: bool
