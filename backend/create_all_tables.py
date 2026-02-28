from app.database import engine
from app.models import core

if __name__ == "__main__":
    core.Base.metadata.create_all(bind=engine)
    print("Tüm tablolar modelden oluşturuldu.")
