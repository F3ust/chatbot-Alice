from pydantic import BaseModel


class ChatRequest(BaseModel):

    message: str
    session_id: str | None = None


class ChatResponse(BaseModel):

    response: str
    session_id: str


class FileUploadResponse(BaseModel):

    filename: str
    file_type: str
    content_preview: str
    session_id: str
    message: str
