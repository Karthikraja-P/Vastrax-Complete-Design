import sys
from app.db.database import engine
from sqlalchemy import inspect
from sqlalchemy.orm import sessionmaker

inspector = inspect(engine)
tables = inspector.get_table_names()

Session = sessionmaker(bind=engine)
session = Session()

for table in tables:
    try:
        count = session.execute(f"SELECT COUNT(*) FROM {table}").scalar()
        print(f"Table: {table}, Rows: {count}")
    except Exception as e:
        print(f"Table: {table}, Error: {e}")
