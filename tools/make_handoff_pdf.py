from pathlib import Path
import textwrap


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "NJN_Project_Handoff.pdf"

TITLE = "NJN Perio and Implant Center - Project Handoff"

SECTIONS = [
    (
        "What Is Done",
        [
            "The repository now contains a free appointment system scaffold for NJN Perio and Implant Center.",
            "Patient website: responsive homepage, clinic info, services, FAQ, WhatsApp query, emergency call, 30-day date picker, Friday blocking, 45-minute slots, slot statuses, booking modal, image validation, and accessibility basics.",
            "Firebase files: firebase.json, firestore.rules, storage.rules, and a sample web config file are included.",
            "Dentist Flutter app: pending request list, detail view, uploaded image display, Accept, Delay, and Avoid flows.",
            "Manual SMS: Accept and Delay open the native SMS app with a pre-filled message. The doctor manually sends the SMS, then marks the request as booked.",
            "Documentation: the root README and dentist app README now describe setup and deployment.",
        ],
    ),
    (
        "What To Do Now",
        [
            "1. Create a Firebase project on the free Spark plan.",
            "2. Enable Firestore, Storage, Hosting, and Firebase Auth with Email/Password.",
            "3. Create one dentist Auth user, copy the UID, and replace REPLACE_WITH_DENTIST_AUTH_UID in firestore.rules and storage.rules.",
            "4. Copy public/firebase-config.sample.js to public/firebase-config.js and paste the real Firebase web config.",
            "5. Create config/businessHours in Firestore with workStart 18:00, workEnd 22:00, slotMinutes 45, and offDays [5].",
            "6. Deploy with: firebase deploy --only hosting,firestore:rules,storage",
            "7. Replace placeholders in dentist_app/lib/firebase_options.dart.",
            "8. Replace doctor@example.com and CHANGE_ME in dentist_app/lib/main.dart with the dentist Auth credentials for testing.",
            "9. Before real distribution, move dentist credentials out of source code.",
        ],
    ),
    (
        "Testing Checklist",
        [
            "Website loads on mobile and desktop.",
            "Fridays cannot be booked.",
            "Slots update when the date changes.",
            "Booking form validates name, age, and phone.",
            "Image upload rejects non-images and files over 5 MB.",
            "Patient request creates a Pending slot.",
            "Dentist app shows pending requests.",
            "Accept opens SMS with the correct confirmation text.",
            "Mark as Booked changes the website slot to Booked.",
            "Avoid makes the slot reusable.",
            "Delay rejects already pending or booked slots.",
        ],
    ),
    (
        "Known Placeholders",
        [
            "public/firebase-config.js must be created from the sample file.",
            "dentist_app/lib/firebase_options.dart still contains placeholder Firebase values.",
            "dentist_app/lib/main.dart still contains dentist email/password placeholders.",
            "Firebase rules still need the real dentist UID.",
        ],
    ),
    (
        "Current Verification",
        [
            "Website JavaScript syntax check passed.",
            "Static website preview returned HTTP 200.",
            "The live preview server has been stopped.",
            "Flutter analysis was not run because Flutter/Dart is not installed in this workspace.",
        ],
    ),
]


def escape_pdf_text(value):
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def add_wrapped(lines, text, width=92):
    for line in textwrap.wrap(text, width=width):
        lines.append(line)


def build_pages():
    pages = []
    lines = [TITLE, "Date: May 7, 2026", ""]
    max_lines = 48

    def push_line(line=""):
        nonlocal lines
        if len(lines) >= max_lines:
            pages.append(lines)
            lines = []
        lines.append(line)

    for heading, items in SECTIONS:
        if len(lines) > max_lines - 8:
            pages.append(lines)
            lines = []
        push_line(heading)
        push_line("-" * len(heading))
        for item in items:
            wrapped = textwrap.wrap(item, width=88)
            for index, part in enumerate(wrapped):
                prefix = "- " if index == 0 and not item[:2].isdigit() else "  "
                if item[:2].isdigit() and index == 0:
                    prefix = ""
                push_line(prefix + part)
        push_line("")

    if lines:
        pages.append(lines)
    return pages


def make_pdf():
    pages = build_pages()
    objects = []

    def obj(data):
        objects.append(data)
        return len(objects)

    font_id = obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    page_ids = []

    for lines in pages:
        commands = ["BT", "/F1 11 Tf", "48 790 Td", "14 TL"]
        first = True
        for line in lines:
            safe = escape_pdf_text(line)
            if first:
                commands.append(f"({safe}) Tj")
                first = False
            else:
                commands.append(f"T* ({safe}) Tj")
        commands.append("ET")
        stream = "\n".join(commands)
        content_id = obj(f"<< /Length {len(stream.encode('utf-8'))} >>\nstream\n{stream}\nendstream")
        page_id = obj(
            f"<< /Type /Page /Parent 0 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 {font_id} 0 R >> >> /Contents {content_id} 0 R >>"
        )
        page_ids.append(page_id)

    kids = " ".join(f"{page_id} 0 R" for page_id in page_ids)
    pages_id = obj(f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>")

    for page_id in page_ids:
        objects[page_id - 1] = objects[page_id - 1].replace("/Parent 0 0 R", f"/Parent {pages_id} 0 R")

    catalog_id = obj(f"<< /Type /Catalog /Pages {pages_id} 0 R >>")

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, data in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{index} 0 obj\n".encode("ascii"))
        pdf.extend(data.encode("utf-8"))
        pdf.extend(b"\nendobj\n")

    xref_offset = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    pdf.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\n"
        f"startxref\n{xref_offset}\n%%EOF\n".encode("ascii")
    )
    OUTPUT.write_bytes(pdf)


if __name__ == "__main__":
    make_pdf()
    print(OUTPUT)
