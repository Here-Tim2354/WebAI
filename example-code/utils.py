from google import genai
from PIL import Image
from google.genai import types
from pprint import pprint
import pathlib

def get_compacted_contents(text,images=None,audios=None,files_path=None,files=None):
    contents=[]
    if images:
        if isinstance(images, list):
            contents.extend(images)
        else:
            contents.append(images)

    if audios:
        if isinstance(audios,list):
            contents.extend(audios)
        else:
            contents.append(audios)

    if files_path:
        if isinstance(files_path,list):
            for fp in files_path:
                contents.append(types.Part.from_bytes(
                    data=fp.read_bytes(),
                    mime_type='application/pdf',
                ))
        else:
            contents.append(types.Part.from_bytes(
                data=files_path.read_bytes(),
                mime_type='application/pdf',
                )
            )

    if files:
        if isinstance(files,list):
            contents.extend(files)
        else:
            contents.append(files)

    contents.append(text)

    return contents

def is_google_search(response):
    return bool(
        response.candidates and
        response.candidates[0].grounding_metadata
    )

def print_response_json(response):
    pprint(response.model_dump(),depth=4,width=100)

def is_url_context(response):
    return bool(
        response.candidates and
        response.candidates[0].url_context_metadata
    )