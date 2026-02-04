from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from circuit_engine import CircuitData, run_simulation, generate_cirq_code

@app.get("/")
def read_root():
    return {"message": "Cirq Quantum Composer Backend"}

@app.post("/simulate")
def simulate(data: CircuitData):
    result = run_simulation(data)
    return result

@app.post("/code")
def get_code(data: CircuitData):
    result = generate_cirq_code(data)
    return result
