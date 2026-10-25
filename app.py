import io
import json
import os
from dotenv import load_dotenv
from google import genai
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# Load .env file on startup (override existing env vars)
load_dotenv(override=True)

app = Flask(__name__, static_folder="static", static_url_path="")
CORS(app)

# Read key from .env (fallback to empty string if not set)
ENV_API_KEY = os.getenv("GEMINI_API_KEY", "")


MODELS_TO_TRY = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.5-flash"]


def call_gemini(api_key: str, prompt: str) -> str:
    # Use env key if caller sends empty string or "env"
    effective_key = api_key.strip()
    if not effective_key or effective_key.lower() == "env":
        effective_key = ENV_API_KEY
    if not effective_key:
        raise ValueError("No Gemini API key provided. Set GEMINI_API_KEY in .env or enter it in the UI.")
    client = genai.Client(api_key=effective_key)
    
    last_err = None
    for model_name in MODELS_TO_TRY:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt
            )
            return response.text
        except Exception as e:
            last_err = e
            continue
    raise last_err


@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/api/env-key", methods=["GET"])
def env_key():
    """Return whether an env API key is configured (never expose the actual key value)."""
    has_key = bool(ENV_API_KEY and ENV_API_KEY != "your_gemini_api_key_here")
    # Return a masked version so the UI knows a key is loaded
    masked = (ENV_API_KEY[:6] + "*" * 20) if has_key else ""
    return jsonify({"has_env_key": has_key, "masked": masked})


@app.route("/api/test-key", methods=["POST"])
def test_key():
    data = request.json or {}
    api_key = data.get("api_key", "")
    try:
        result = call_gemini(api_key, "Say: API key is valid.")
        return jsonify({"success": True, "message": result})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 400


@app.route("/api/extract-text", methods=["POST"])
def extract_text():
    """Extract text from uploaded files: PDF, DOCX, TXT, JSON, MD, FOUNTAIN."""
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file uploaded"}), 400
    file = request.files["file"]
    filename = file.filename or "uploaded_file"
    ext = os.path.splitext(filename)[1].lower()

    try:
        content = ""
        file_bytes = file.read()

        if ext == ".pdf":
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            pages = []
            for p in reader.pages:
                text = p.extract_text()
                if text:
                    pages.append(text)
            content = "\n\n".join(pages)

        elif ext in [".docx", ".doc"]:
            import docx
            doc = docx.Document(io.BytesIO(file_bytes))
            content = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])

        elif ext == ".json":
            raw_text = file_bytes.decode("utf-8", errors="replace")
            try:
                data = json.loads(raw_text)
                if isinstance(data, dict):
                    # Check common story or screenplay keys
                    for key in ["story", "screenplay", "script", "text", "content", "synopsis", "body"]:
                        if key in data and isinstance(data[key], str):
                            content = data[key]
                            break
                    if not content:
                        content = json.dumps(data, indent=2)
                elif isinstance(data, list):
                    content = json.dumps(data, indent=2)
                else:
                    content = str(data)
            except Exception:
                content = raw_text

        else:  # .txt, .md, .fountain, etc.
            content = file_bytes.decode("utf-8", errors="replace")

        content = content.strip()
        if not content:
            return jsonify({"success": False, "error": f"File '{filename}' was empty or had no extractable text."}), 400

        return jsonify({
            "success": True,
            "filename": filename,
            "text": content,
            "char_count": len(content),
            "word_count": len(content.split())
        })
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to extract text from {filename}: {str(e)}"}), 500


@app.route("/api/story-to-screenplay", methods=["POST"])
def story_to_screenplay():
    data = request.json
    api_key = data.get("api_key", "")
    story = data.get("story", "")
    language = data.get("language", "English")

    lang_instruction = ""
    if language == "Tenglish":
        lang_instruction = "Write all dialogue in Tenglish (natural Telugu-English code-switching). Scene headings and action lines remain in English."
    elif language == "Hinglish":
        lang_instruction = "Write all dialogue in Hinglish (natural Hindi-English code-switching). Scene headings and action lines remain in English."

    prompt = f"""You are a professional screenplay writer. Convert this story into a properly formatted Hollywood screenplay.

Format rules:
FADE IN:
INT./EXT. LOCATION - DAY/NIGHT  (sluglines in ALL CAPS)
Action description in present tense.
CHARACTER NAME
(parenthetical if needed)
Dialogue here.
CUT TO: / FADE OUT.

{lang_instruction}

Story to convert:
{story}

Write the complete, properly formatted screenplay. Be thorough."""

    try:
        result = call_gemini(api_key, prompt)
        return jsonify({"success": True, "screenplay": result})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/script-assist", methods=["POST"])
def script_assist():
    data = request.json
    api_key = data.get("api_key", "")
    screenplay = data.get("screenplay", "")
    instruction = data.get("instruction", "")
    language = data.get("language", "English")

    lang_note = ""
    if language == "Tenglish":
        lang_note = "Dialogue should be in Tenglish."
    elif language == "Hinglish":
        lang_note = "Dialogue should be in Hinglish."

    prompt = f"""You are an expert screenplay editor. Apply this instruction to the screenplay.

Instruction: {instruction}
{lang_note}

Screenplay:
{screenplay}

Return ONLY the modified screenplay with proper formatting."""

    try:
        result = call_gemini(api_key, prompt)
        return jsonify({"success": True, "result": result})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/language-convert", methods=["POST"])
def language_convert():
    data = request.json
    api_key = data.get("api_key", "")
    dialogue = data.get("dialogue", "")
    target_lang = data.get("target_lang", "Tenglish")
    character_name = data.get("character_name", "")
    personality = data.get("character_personality", "")

    example = ""
    if target_lang == "Tenglish":
        example = "Example: 'Where were you last night?' becomes 'Nuvvu last night ekkada unnava?'"
    elif target_lang == "Hinglish":
        example = "Example: 'Where were you last night?' becomes 'Tum kal raat kahaan the?'"

    prompt = f"""Convert this dialogue to {target_lang} using natural code-switching (NOT word-for-word translation).

Character: {character_name}
Personality: {personality}
{example}

Rules:
- Preserve emotional tone and subtext
- Keep character voice authentic
- Use natural code-switching patterns
- Include regional expressions and slang where appropriate
- Maintain cultural context

Original dialogue:
{dialogue}

{target_lang} version:"""

    try:
        result = call_gemini(api_key, prompt)
        return jsonify({"success": True, "result": result})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/character-bible", methods=["POST"])
def character_bible():
    data = request.json
    api_key = data.get("api_key", "")
    content = data.get("content", "")

    prompt = f"""You are a professional script analyst. Analyze this story/screenplay and create a comprehensive Character Bible for ALL characters.

For each character, provide this complete profile:

**[CHARACTER NAME]**
- Age:
- Gender:
- Occupation:
- Personality: (3-5 key traits)
- Background: (brief backstory)
- Motivation: (what drives them)
- Goal: (what they want)
- Fear: (what they are afraid of)
- Strength:
- Weakness:
- Relationships: (key relationships)
- Character Arc: (how they change)
- Emotional State: (at start / at end)
- Dialogue Style: (vocabulary, register, patterns)
- Speech Patterns: (distinctive phrases or quirks)

Content to analyze:
{content}"""

    try:
        result = call_gemini(api_key, prompt)
        return jsonify({"success": True, "result": result})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/character-develop", methods=["POST"])
def character_develop():
    data = request.json
    api_key = data.get("api_key", "")
    name = data.get("character_name", "")
    desc = data.get("character_description", "")
    context = data.get("story_context", "")

    prompt = f"""You are an expert character development consultant. Analyze and provide detailed improvement guidance.

Character Name: {name}
Character Description: {desc}
Story Context: {context}

Provide a full character analysis covering:

**1. Motivation Analysis** - Is it clear and compelling?
**2. Internal Conflict** - What inner struggles does this character face?
**3. External Conflict** - What external obstacles exist?
**4. Character Arc** - How does the character change and grow?
**5. Agency** - Does the character drive the story or merely react?
**6. Relationships** - How do relationships define and challenge them?
**7. Transformation** - What transformation is possible?

Then:
**Weakness Diagnosis** - Why does this character feel weak or underdeveloped?
**Improvement Suggestions** - Specific, actionable improvements
**Alternative Story Directions** - 3 different paths this character could take
**Sample Dialogue** - 3-5 example lines that reveal deeper character"""

    try:
        result = call_gemini(api_key, prompt)
        return jsonify({"success": True, "result": result})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/script-doctor", methods=["POST"])
def script_doctor():
    data = request.json
    api_key = data.get("api_key", "")
    screenplay = data.get("screenplay", "")

    prompt = f"""You are a professional Script Doctor. Provide a thorough diagnosis of this screenplay.

**SCRIPT DOCTOR REPORT**

Identify and diagnose ALL issues in these categories:
1. WEAK SCENES - scenes lacking purpose, tension, or clarity
2. REDUNDANT SCENES - scenes that repeat info without advancing the story
3. POOR DIALOGUE - unnatural, on-the-nose, or expository dialogue
4. EXPOSITION PROBLEMS - clunky or forced exposition
5. PACING ISSUES - where the script drags or rushes
6. CHARACTER INCONSISTENCY - characters acting against their established nature
7. PLOT HOLES - logic gaps or unresolved threads
8. MISSING SETUP/PAYOFF - promises made but not fulfilled
9. WEAK TRANSITIONS - poor scene-to-scene flow
10. REPETITIVE DIALOGUE - same info repeated multiple times
11. UNREALISTIC BEHAVIOUR - illogical character decisions
12. GENRE VIOLATIONS - elements that break genre expectations

For each issue found, provide:
Scene/Location | Problem | Diagnosis | Recommendation | Optional Rewrite

End with:
**Script Health Score** overall and per category (1-10)

Screenplay to diagnose:
{screenplay}"""

    try:
        result = call_gemini(api_key, prompt)
        return jsonify({"success": True, "result": result})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/script-coverage", methods=["POST"])
def script_coverage():
    data = request.json
    api_key = data.get("api_key", "")
    screenplay = data.get("screenplay", "")

    prompt = f"""You are a professional script reader at a major film production company. Write a comprehensive Script Coverage report.

**SCRIPT COVERAGE REPORT**

LOGLINE: (one sentence capturing the core premise)

SYNOPSIS: (300-400 words covering act structure and key plot points)

CHARACTER BREAKDOWN:
(Each main character: name, role, brief description)

GENRE: (Primary + Secondary genre + tone)

THEMES: (Central themes)

FORMAT: (Feature / Short | Estimated pages | Time period | Setting)

ANALYSIS:
Structure: __/10 - (notes)
Concept and Premise: __/10 - (notes)
Characters: __/10 - (notes)
Dialogue: __/10 - (notes)
Pacing: __/10 - (notes)
Visual Storytelling: __/10 - (notes)
Marketability: __/10 - (notes)

STRENGTHS:
(Detailed bullet list of what works)

WEAKNESSES:
(Detailed bullet list of what needs work)

MARKET POSITIONING: (Where does it fit in today's market?)

COMPARABLE FILMS: (Similar films for context)

WRITER RECOMMENDATIONS: (Specific advice for the writer)

OVERALL SCORE: __/10

RECOMMENDATION: PASS / CONSIDER / RECOMMEND / RECOMMEND WITH REVISIONS

EXECUTIVE NOTES:

Screenplay:
{screenplay}"""

    try:
        result = call_gemini(api_key, prompt)
        return jsonify({"success": True, "result": result})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/continue-scene", methods=["POST"])
def continue_scene():
    data = request.json
    api_key = data.get("api_key", "")
    screenplay = data.get("screenplay", "")
    language = data.get("language", "English")

    lang_note = ""
    if language == "Tenglish":
        lang_note = "Continue with dialogue in Tenglish."
    elif language == "Hinglish":
        lang_note = "Continue with dialogue in Hinglish."

    prompt = f"""You are a professional screenwriter. Continue this screenplay from where it ends.
Maintain the same style, tone, character voices, and story direction.
Add at least one complete, well-developed scene.
{lang_note}

Screenplay so far:
{screenplay}

[CONTINUE SCREENPLAY HERE]"""

    try:
        result = call_gemini(api_key, prompt)
        return jsonify({"success": True, "result": result})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
