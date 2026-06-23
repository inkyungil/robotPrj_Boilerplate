import os
import sys
import json
from sqlalchemy import select

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.database import SessionLocal
from app.models import Book

def escape_sql(val):
    if val is None:
        return "NULL"
    if isinstance(val, bool):
        return "1" if val else "0"
    if isinstance(val, int):
        return str(val)
    # Escape single quotes and backslashes for SQL INSERT statement
    escaped = val.replace("\\", "\\\\").replace("'", "\\'")
    return f"'{escaped}'"

def main():
    db = SessionLocal()
    try:
        books = db.execute(select(Book).order_by(Book.id.asc())).scalars().all()
        
        insert_rows = []
        for b in books:
            row = (
                f"({b.id},"
                f"{escape_sql(b.title_kr)},"
                f"{escape_sql(b.title_en)},"
                f"{escape_sql(b.title_zh)},"
                f"{escape_sql(b.title_vi)},"
                f"{escape_sql(b.author)},"
                f"{escape_sql(b.category)},"
                f"{escape_sql(b.cover)},"
                f"{escape_sql(b.color)},"
                f"{escape_sql(b.zone)},"
                f"{escape_sql(b.shelf)},"
                f"{1 if b.in_stock else 0},"
                f"{escape_sql(b.summary_kr)},"
                f"{escape_sql(b.summary_en)},"
                f"{escape_sql(b.summary_zh)},"
                f"{escape_sql(b.summary_vi)},"
                f"{escape_sql(b.for_whom_kr)},"
                f"{escape_sql(b.for_whom_en)},"
                f"{escape_sql(b.for_whom_zh)},"
                f"{escape_sql(b.for_whom_vi)})"
            )
            insert_rows.append(row)
        
        sql_content = "INSERT INTO `books` VALUES\n" + ",\n".join(insert_rows) + ";"
        
        sql_file_path = "/home/Aiprj/RobotChatAI/chatbot/frontend/setup-labi-db.sql"
        with open(sql_file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
            
        start_idx = -1
        end_idx = -1
        for i, line in enumerate(lines):
            if "INSERT INTO `books` VALUES" in line or "INSERT INTO books VALUES" in line:
                start_idx = i
                break
        
        if start_idx == -1:
            print("Could not find INSERT INTO `books` VALUES in SQL file")
            return
            
        for i in range(start_idx, len(lines)):
            if ";" in lines[i]:
                end_idx = i
                break
                
        if end_idx == -1:
            print("Could not find end of INSERT statement in SQL file")
            return
            
        print(f"Replacing lines from {start_idx+1} to {end_idx+1} in {sql_file_path}")
        
        new_lines = lines[:start_idx] + [sql_content + "\n"] + lines[end_idx+1:]
        
        with open(sql_file_path, "w", encoding="utf-8") as f:
            f.writelines(new_lines)
            
        print("Successfully updated setup-labi-db.sql with 210 realistic books!")
        
    finally:
        db.close()

if __name__ == "__main__":
    main()
