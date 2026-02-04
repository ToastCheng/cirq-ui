# Cirq Web Composer

A web-based quantum circuit composer inspired by IBM Quantum Composer, built with **React** and **Cirq**.

## Overview

This project provides a drag-and-drop interface for building quantum circuits and simulates them in real-time using Google's [Cirq](https://quantumai.google/cirq) library.

### Key Features
- **Interactive UI**: Drag and drop gates (H, X, Y, Z, CNOT) to build circuits.
- **Real-time Simulation**: Automatically runs state vector simulation as you modify the circuit.
- **Visualizations**: 
  - **Bloch Spheres**: Visualizes the state of individual qubits.
  - **State Vector**: Displays the full quantum state amplitudes.
- **Code Generation**: Live export of the equivalent Cirq Python code.

## Architecture

- **Frontend**: React (Vite) + `dnd-kit` for drag-and-drop interactions.
- **Backend**: FastAPI (Python) exposing Cirq simulation endpoints.

## Development Setup

### Prerequisites
- Node.js (v16+) and npm
- Python 3.10+

### 1. Backend Setup

Navigate to the `backend` directory:

```bash
cd backend
```

Create a virtual environment and install dependencies:

```bash
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn cirq
```

Run the server:

```bash
# Runs on http://127.0.0.1:8000
uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup

Navigate to the `frontend` directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
# Runs on http://localhost:5173
npm run dev
```

## Usage

1. Open your browser to `http://localhost:5173`.
2. Drag gates from the **Gates** palette on the left to the circuit grid.
3. Observe the **Bloch Spheres** and **State Vector** updating in real-time.
4. Copy the generated Python code from the **Cirq Code** panel.
