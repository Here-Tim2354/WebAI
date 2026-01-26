from PIL import Image

def get_compacted_contents(text,images=None,audio=None):
    contents=[]
    if images:
        if isinstance(images, Image.Image):
            contents.append(images)
        else:
            contents.extend(images)
    if audio:
        contents.extend(audio)
    contents.append(text)

    return contents


