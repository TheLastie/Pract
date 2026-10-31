"""Начальные записи, перенесённые из каталога ЛР №2."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Mushroom


SAMPLE_MUSHROOMS = [
    {"name": "Белый гриб", "latin": "Boletus edulis", "family": "Болетовые", "season": "июнь — октябрь", "category": "edible", "description": "Король леса: плотная белая мякоть, ореховый аромат. Растёт под елями, соснами и дубами.", "illustration": "/assets/images/boletus-edulis.jpg", "photo": "/assets/images/boletus-photo.jpg", "plate": "Таб. I"},
    {"name": "Лисичка обыкновенная", "latin": "Cantharellus cibarius", "family": "Лисичковые", "season": "июнь — ноябрь", "category": "edible", "description": "Ярко-жёлтая воронка с фруктовым запахом. Почти не бывает червивой — мякоть не по вкусу личинкам.", "illustration": "/assets/images/chanterelle.jpg", "photo": "/assets/images/chanterelle-photo.jpg", "plate": "Таб. II"},
    {"name": "Подосиновик", "latin": "Leccinum aurantiacum", "family": "Болетовые", "season": "июль — октябрь", "category": "edible", "description": "Огненно-рыжая шляпка и ножка в тёмных чешуйках. Верный спутник молодых осинников.", "illustration": "/assets/images/leccinum.jpg", "photo": "/assets/images/leccinum-photo.jpg", "plate": "Таб. III"},
    {"name": "Мухомор красный", "latin": "Amanita muscaria", "family": "Аманитовые", "season": "август — ноябрь", "category": "poisonous", "description": "Самый узнаваемый гриб мира. Ядовитый вид с красной шляпкой и белыми бородавками.", "illustration": "/assets/images/muscaria.jpg", "photo": "/assets/images/muscaria-photo.jpg", "plate": "Таб. IV"},
    {"name": "Бледная поганка", "latin": "Amanita phalloides", "family": "Аманитовые", "season": "июль — октябрь", "category": "poisonous", "description": "Бледно-зелёная шляпка, белые пластинки и вольва у основания ножки.", "illustration": "/assets/images/phalloides.jpg", "photo": "/assets/images/phalloides-photo.jpg", "plate": "Таб. V"},
    {"name": "Сатанинский гриб", "latin": "Rubroboletus satanas", "family": "Болетовые", "season": "июнь — сентябрь", "category": "poisonous", "description": "Массивный гриб со светлой шляпкой и утолщённой жёлто-красной ножкой.", "illustration": "/assets/images/satanas.jpg", "photo": "/assets/images/satanas-photo.jpg", "plate": "Таб. VI"},
]


def seed_if_empty(db: Session) -> None:
    if db.scalar(select(Mushroom.id).limit(1)) is None:
        db.add_all(Mushroom(**item) for item in SAMPLE_MUSHROOMS)
        db.commit()
