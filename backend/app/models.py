from pydantic import BaseModel
from typing import List, Optional

class ChatRequest(BaseModel):
    message: str
    mode: str  # "RAG" atau "JSON"
    history: Optional[List[dict]] = [] # Format: [{"role": "user", "content": "..."}]

class ProcessRequest(BaseModel):
    mode: str # "RAG" atau "JSON"

class ChatResponse(BaseModel):
    response: str
    context_used: Optional[str] = None
