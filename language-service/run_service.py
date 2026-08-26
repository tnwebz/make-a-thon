import uvicorn
from app.config import HOST, PORT

if __name__ == "__main__":
    print(f"Starting SkillForge Indic Language Service on {HOST}:{PORT}...")
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=False, log_level="info")
