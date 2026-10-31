"""CRUD endpoints for the mushroom catalog."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from .. import crud
from ..database import get_db
from ..schemas import MushroomCreate, MushroomRead, MushroomUpdate


router = APIRouter(prefix="/mushrooms", tags=["Грибы"])
DatabaseSession = Annotated[Session, Depends(get_db)]
MAX_PHOTO_SIZE = 5 * 1024 * 1024


def photo_type(data: bytes | bytearray) -> str | None:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


@router.get("", response_model=list[MushroomRead], summary="Получить список грибов")
def read_mushrooms(db: DatabaseSession) -> list[MushroomRead]:
    """Возвращает все записи каталога."""
    return crud.get_mushrooms(db)


@router.post(
    "", response_model=MushroomRead, status_code=status.HTTP_201_CREATED,
    summary="Добавить гриб", responses={422: {"description": "Ошибка проверки полей"}},
)
def create_mushroom(data: MushroomCreate, db: DatabaseSession) -> MushroomRead:
    """Создаёт запись после проверки полей."""
    return crud.create_mushroom(db, data)


@router.get(
    "/{mushroom_id}", response_model=MushroomRead,
    summary="Получить гриб по идентификатору", responses={404: {"description": "Запись не найдена"}},
)
def read_mushroom(mushroom_id: int, db: DatabaseSession) -> MushroomRead:
    mushroom = crud.get_mushroom(db, mushroom_id)
    if mushroom is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Гриб не найден")
    return mushroom


@router.put("/{mushroom_id}/photo", response_model=MushroomRead, summary="Загрузить фото гриба")
async def upload_photo(
    mushroom_id: int, request: Request, db: DatabaseSession,
    slot: int = Query(1, ge=1, le=2),
) -> MushroomRead:
    mushroom = crud.get_mushroom(db, mushroom_id)
    if mushroom is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Гриб не найден")
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > MAX_PHOTO_SIZE:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Фото должно быть не больше 5 МБ")
    image_type = photo_type(data)
    if image_type is None:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Загрузите фото в формате JPEG, PNG, GIF или WebP")
    if slot == 1:
        mushroom.photo_data = bytes(data)
        mushroom.photo = f"/api/mushrooms/{mushroom_id}/photo"
    else:
        mushroom.photo_data_2 = bytes(data)
        mushroom.photo2 = f"/api/mushrooms/{mushroom_id}/photo?slot=2"
    db.commit()
    db.refresh(mushroom)
    return mushroom


@router.get("/{mushroom_id}/photo", response_class=Response, summary="Получить фото гриба")
def read_photo(
    mushroom_id: int, db: DatabaseSession, slot: int = Query(1, ge=1, le=2),
) -> Response:
    mushroom = crud.get_mushroom(db, mushroom_id)
    data = None if mushroom is None else mushroom.photo_data if slot == 1 else mushroom.photo_data_2
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Фото не найдено")
    return Response(content=data, media_type=photo_type(data))


@router.patch(
    "/{mushroom_id}", response_model=MushroomRead,
    summary="Изменить запись", responses={404: {"description": "Запись не найдена"}},
)
def patch_mushroom(mushroom_id: int, data: MushroomUpdate, db: DatabaseSession) -> MushroomRead:
    mushroom = crud.get_mushroom(db, mushroom_id)
    if mushroom is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Гриб не найден")
    changes = data.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Передайте хотя бы одно поле")
    return crud.update_mushroom(db, mushroom, data)


@router.delete(
    "/{mushroom_id}", status_code=status.HTTP_204_NO_CONTENT,
    summary="Удалить запись", responses={404: {"description": "Запись не найдена"}},
)
def remove_mushroom(mushroom_id: int, db: DatabaseSession) -> Response:
    mushroom = crud.get_mushroom(db, mushroom_id)
    if mushroom is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Гриб не найден")
    crud.delete_mushroom(db, mushroom)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
