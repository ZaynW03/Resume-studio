"""Persistent profile library - pool of user history used to assemble resumes."""
from fastapi import APIRouter
from app.models.schema import ProfileLibrary
from app.services import storage

router = APIRouter()


@router.get("")
def get_profile():
    return storage.load_profile().model_dump()


@router.put("")
def save_profile(profile: ProfileLibrary):
    return storage.save_profile(profile).model_dump()
