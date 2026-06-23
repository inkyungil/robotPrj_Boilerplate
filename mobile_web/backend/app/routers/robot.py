import time
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db, SessionLocal
from ..models import Member, Book, RobotTask
from ..schemas import RobotTaskCreate, RobotTaskOut
from ..security import get_current_member

router = APIRouter(prefix="/api/robot", tags=["robot"])


def simulate_robot_task(task_id: int):
    """
    Simulates the physical robot's movements in the library:
    - 4s: Moving to the book's zone (moving)
    - 5s: Picking up the book from the shelf (retrieved)
    - 4s: Delivering the book to the counter/shelf (delivering)
    - 5s: Delivered successfully (completed) and update book in_stock status
    """
    transitions = [
        ("moving", 4),
        ("retrieved", 5),
        ("delivering", 4),
        ("completed", 5)
    ]
    
    for next_status, delay in transitions:
        time.sleep(delay)
        db = SessionLocal()
        try:
            task = db.get(RobotTask, task_id)
            if not task:
                break
            
            task.status = next_status
            
            # When the book is retrieved, we can toggle inventory, or when completed.
            if next_status == "completed":
                book = db.get(Book, task.book_id)
                if book:
                    # In library scenario, set in_stock = 0 (checked out)
                    book.in_stock = False
                    
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[Robot Simulation Error] {e}")
            break
        finally:
            db.close()


@router.post("/call", response_model=RobotTaskOut, status_code=status.HTTP_201_CREATED)
def call_robot(
    data: RobotTaskCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current: Member = Depends(get_current_member)
):
    # Check if the book exists
    book = db.get(Book, data.book_id)
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="해당 도서를 찾을 수 없습니다."
        )
    
    if not book.in_stock:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="현재 대출 중인 도서라 로봇이 수거할 수 없습니다."
        )

    # Create new robot task
    task = RobotTask(
        member_id=current.id,
        book_id=book.id,
        status="requested",
        zone=book.zone,
        shelf=book.shelf
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    # Start the simulation background task
    background_tasks.add_task(simulate_robot_task, task.id)

    # Prepare response
    res = RobotTaskOut.model_validate(task)
    res.book_title = book.title_kr
    return res


@router.get("/tasks", response_model=list[RobotTaskOut])
def list_tasks(
    db: Session = Depends(get_db),
    current: Member = Depends(get_current_member)
):
    stmt = select(RobotTask).where(RobotTask.member_id == current.id).order_by(RobotTask.created_at.desc())
    tasks = db.scalars(stmt).all()
    
    res_list = []
    for t in tasks:
        book = db.get(Book, t.book_id)
        out = RobotTaskOut.model_validate(t)
        out.book_title = book.title_kr if book else "알 수 없는 도서"
        res_list.append(out)
        
    return res_list


@router.get("/tasks/{task_id}", response_model=RobotTaskOut)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current: Member = Depends(get_current_member)
):
    task = db.get(RobotTask, task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="요청된 작업을 찾을 수 없습니다."
        )
    
    if task.member_id != current.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="해당 작업의 상태를 조회할 권한이 없습니다."
        )
        
    book = db.get(Book, task.book_id)
    out = RobotTaskOut.model_validate(task)
    out.book_title = book.title_kr if book else "알 수 없는 도서"
    return out


@router.post("/tasks/{task_id}/reset", response_model=RobotTaskOut)
def reset_task(
    task_id: int,
    db: Session = Depends(get_db),
    current: Member = Depends(get_current_member)
):
    task = db.get(RobotTask, task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="요청된 작업을 찾을 수 없습니다."
        )
    
    if task.member_id != current.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="해당 작업을 초기화할 권한이 없습니다."
        )
        
    # Reset status
    task.status = "requested"
    db.commit()
    db.refresh(task)
    
    # Update book status to in_stock = 1 so it's active again
    book = db.get(Book, task.book_id)
    if book:
        book.in_stock = True
        db.commit()
        
    book_title = book.title_kr if book else "알 수 없는 도서"
    out = RobotTaskOut.model_validate(task)
    out.book_title = book_title
    return out
