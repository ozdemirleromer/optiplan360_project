import os
import sys

# Proje dizinini ekle
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from app.database import engine, Base
from app.models import MachineConfig, OptimizationJob, OptimizationReport

def migrate():
    print("Tablolar oluşturuluyor...")
    Base.metadata.create_all(bind=engine)
    print("Tablolar oluşturuldu!")
    
if __name__ == "__main__":
    migrate()
