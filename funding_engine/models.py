from sqlalchemy import create_engine, Column, Integer, String, Float, Date, DateTime, Numeric, ForeignKey, Enum, text
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

Base = declarative_base()

# --- EXISTING MODULE (Financiacion) ---
# We treat 'public.cauciones' as an existing table to map to.
# Note: We use 'cauciones' table name. If integration fails, user might need to adjust table name.
class Caucion(Base):
    __tablename__ = 'cauciones'
    # We define only the fields we need for calculation, plus PK
    # If the table uses UUIDs as provided in the prompt:
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id = Column(UUID(as_uuid=True), nullable=False)
    
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=False)
    
    # Financials
    capital = Column(Numeric, nullable=False)
    monto_devolver = Column(Numeric, nullable=False)
    interes = Column(Numeric, nullable=False)
    dias = Column(Integer, nullable=False)
    tna_real = Column(Numeric, nullable=False)
    
    # Optional metadata
    archivo = Column(String, nullable=True)

# --- NEW MODULE (Funding & Carry) ---

class InstrumentoFCI(Base):
    __tablename__ = 'instrumentos_fci'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String, nullable=False)
    ticker = Column(String, nullable=True) # e.g. "PRBA"
    sociedad_gerente = Column(String, nullable=True)
    tipo = Column(String, nullable=False) # 'money_market', 't+1'
    
    # Relationships
    precios = relationship("SerieVCP", back_populates="fci", cascade="all, delete-orphan")
    movimientos = relationship("MovimientoFCI", back_populates="fci", cascade="all, delete-orphan")

class SerieVCP(Base):
    __tablename__ = 'serie_vcp'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    fci_id = Column(Integer, ForeignKey('instrumentos_fci.id'), nullable=False)
    fecha = Column(Date, nullable=False)
    vcp = Column(Float, nullable=False) # Valor Cuota Parte
    
    fci = relationship("InstrumentoFCI", back_populates="precios")

class MovimientoFCI(Base):
    __tablename__ = 'movimientos_fci'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    fci_id = Column(Integer, ForeignKey('instrumentos_fci.id'), nullable=False)
    fecha = Column(DateTime, nullable=False) # Important: datetime for precise sizing if needed, usually date enough
    tipo = Column(String, nullable=False) # 'SUSCRIPCION', 'RESCATE'
    monto = Column(Float, nullable=False)
    cuotas = Column(Float, nullable=False)
    motivo = Column(String, nullable=True) # 'funding_caucion', 'retiro_activos'
    
    fci = relationship("InstrumentoFCI", back_populates="movimientos")
    activo_comprado = relationship("ActivoComprado", uselist=False, back_populates="movimiento")

class ActivoComprado(Base):
    __tablename__ = 'activos_comprados_funding'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    mov_id = Column(Integer, ForeignKey('movimientos_fci.id'), nullable=False)
    
    tipo_activo = Column(String, nullable=False) # 'cedear', 'bono', 'on'
    monto_retirado = Column(Float, nullable=False) # Should match MovimientoFCI.monto
    rendimiento_esperado = Column(Float, nullable=True) # Annualized expected yield (optional for metrics)
    
    movimiento = relationship("MovimientoFCI", back_populates="activo_comprado")
