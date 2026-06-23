import json
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from ..database import get_db
from ..models import Book, AdminUser
from ..security import get_current_admin

router = APIRouter(prefix="/api/books", tags=["books"])

class TitleLang(BaseModel):
    KR: str
    EN: str
    ZH: str
    VI: str

class SummaryLang(BaseModel):
    KR: Optional[str] = ""
    EN: Optional[str] = ""
    ZH: Optional[str] = ""
    VI: Optional[str] = ""

class ForWhomLang(BaseModel):
    KR: Optional[List[str]] = []
    EN: Optional[List[str]] = []
    ZH: Optional[List[str]] = []
    VI: Optional[List[str]] = []

class BookCreate(BaseModel):
    title: TitleLang
    author: str
    category: str
    cover: str
    color: str
    zone: str
    shelf: str
    inStock: bool
    summary: Optional[SummaryLang] = None
    forWhom: Optional[ForWhomLang] = None

@router.get("")
def list_books(
    q: Optional[str] = Query(default=None),
    db: Session = Depends(get_db)
):
    stmt = select(Book)
    if q:
        like = f"%{q}%"
        cond = or_(
            Book.title_kr.like(like),
            Book.title_en.like(like),
            Book.title_zh.like(like),
            Book.title_vi.like(like),
            Book.author.like(like),
            Book.category.like(like),
            Book.zone.like(like),
        )
        stmt = stmt.where(cond)
    
    stmt = stmt.order_by(Book.id.asc())
    books = db.scalars(stmt).all()
    
    res = []
    for b in books:
        try:
            fw_kr = json.loads(b.for_whom_kr) if b.for_whom_kr else []
        except Exception:
            fw_kr = []
        try:
            fw_en = json.loads(b.for_whom_en) if b.for_whom_en else []
        except Exception:
            fw_en = []
        try:
            fw_zh = json.loads(b.for_whom_zh) if b.for_whom_zh else []
        except Exception:
            fw_zh = []
        try:
            fw_vi = json.loads(b.for_whom_vi) if b.for_whom_vi else []
        except Exception:
            fw_vi = []
            
        res.append({
            "id": str(b.id),
            "title": {
                "KR": b.title_kr,
                "EN": b.title_en,
                "ZH": b.title_zh,
                "VI": b.title_vi
            },
            "author": b.author,
            "category": b.category,
            "cover": b.cover,
            "color": b.color,
            "zone": b.zone,
            "shelf": b.shelf,
            "inStock": b.in_stock,
            "summary": {
                "KR": b.summary_kr or "",
                "EN": b.summary_en or "",
                "ZH": b.summary_zh or "",
                "VI": b.summary_vi or ""
            },
            "forWhom": {
                "KR": fw_kr,
                "EN": fw_en,
                "ZH": fw_zh,
                "VI": fw_vi
            }
        })
    return res

@router.get("/{book_id}")
def get_book(book_id: int, db: Session = Depends(get_db)):
    b = db.get(Book, book_id)
    if not b:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="도서를 찾을 수 없습니다.")
        
    try:
        fw_kr = json.loads(b.for_whom_kr) if b.for_whom_kr else []
    except Exception:
        fw_kr = []
    try:
        fw_en = json.loads(b.for_whom_en) if b.for_whom_en else []
    except Exception:
        fw_en = []
    try:
        fw_zh = json.loads(b.for_whom_zh) if b.for_whom_zh else []
    except Exception:
        fw_zh = []
    try:
        fw_vi = json.loads(b.for_whom_vi) if b.for_whom_vi else []
    except Exception:
        fw_vi = []
        
    return {
        "id": str(b.id),
        "title": {
            "KR": b.title_kr,
            "EN": b.title_en,
            "ZH": b.title_zh,
            "VI": b.title_vi
        },
        "author": b.author,
        "category": b.category,
        "cover": b.cover,
        "color": b.color,
        "zone": b.zone,
        "shelf": b.shelf,
        "inStock": b.in_stock,
        "summary": {
            "KR": b.summary_kr or "",
            "EN": b.summary_en or "",
            "ZH": b.summary_zh or "",
            "VI": b.summary_vi or ""
        },
        "forWhom": {
            "KR": fw_kr,
            "EN": fw_en,
            "ZH": fw_zh,
            "VI": fw_vi
        }
    }

@router.post("", status_code=status.HTTP_201_CREATED)
def create_book(
    data: BookCreate,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(get_current_admin)
):
    b = Book(
        title_kr=data.title.KR,
        title_en=data.title.EN,
        title_zh=data.title.ZH,
        title_vi=data.title.VI,
        author=data.author,
        category=data.category,
        cover=data.cover,
        color=data.color,
        zone=data.zone,
        shelf=data.shelf,
        in_stock=data.inStock,
        summary_kr=data.summary.KR if data.summary else "",
        summary_en=data.summary.EN if data.summary else "",
        summary_zh=data.summary.ZH if data.summary else "",
        summary_vi=data.summary.VI if data.summary else "",
        for_whom_kr=json.dumps(data.forWhom.KR, ensure_ascii=False) if data.forWhom else "[]",
        for_whom_en=json.dumps(data.forWhom.EN, ensure_ascii=False) if data.forWhom else "[]",
        for_whom_zh=json.dumps(data.forWhom.ZH, ensure_ascii=False) if data.forWhom else "[]",
        for_whom_vi=json.dumps(data.forWhom.VI, ensure_ascii=False) if data.forWhom else "[]",
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    return {"id": str(b.id), "success": True}

@router.put("/{book_id}")
def update_book(
    book_id: int,
    data: BookCreate,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(get_current_admin)
):
    b = db.get(Book, book_id)
    if not b:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="도서를 찾을 수 없습니다.")
        
    b.title_kr = data.title.KR
    b.title_en = data.title.EN
    b.title_zh = data.title.ZH
    b.title_vi = data.title.VI
    b.author = data.author
    b.category = data.category
    b.cover = data.cover
    b.color = data.color
    b.zone = data.zone
    b.shelf = data.shelf
    b.in_stock = data.inStock
    
    if data.summary:
        b.summary_kr = data.summary.KR
        b.summary_en = data.summary.EN
        b.summary_zh = data.summary.ZH
        b.summary_vi = data.summary.VI
        
    if data.forWhom:
        b.for_whom_kr = json.dumps(data.forWhom.KR, ensure_ascii=False)
        b.for_whom_en = json.dumps(data.forWhom.EN, ensure_ascii=False)
        b.for_whom_zh = json.dumps(data.forWhom.ZH, ensure_ascii=False)
        b.for_whom_vi = json.dumps(data.forWhom.VI, ensure_ascii=False)
        
    db.commit()
    return {"id": str(b.id), "success": True}

@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(
    book_id: int,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(get_current_admin)
):
    b = db.get(Book, book_id)
    if not b:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="도서를 찾을 수 없습니다.")
        
    db.delete(b)
    db.commit()
    return
