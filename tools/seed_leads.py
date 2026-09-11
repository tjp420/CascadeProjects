import os
import csv

LEADS_DATA = [
    {
        "company": "KryptonData",
        "contact": "Alex Rivera",
        "title": "CTO",
        "linkedin": "https://linkedin.com/in/alex-rivera",
        "trigger": "Just raised $4M Seed. Moving upmarket to enterprise banks.",
        "funding": "$4M",
        "eng_team": 12,
    },
    {
        "company": "SaaSForge Analytics",
        "contact": "Elena Rostova",
        "title": "VP of Engineering",
        "linkedin": "https://linkedin.com/in/elena-rostova",
        "trigger": "Actively hiring Senior Next.js/Node engineers to rewrite legacy stack.",
        "funding": "$2.5M",
        "eng_team": 8,
    },
    {
        "company": "HealthSync AI",
        "contact": "Devon Miller",
        "title": "Chief Technology Officer",
        "linkedin": "https://linkedin.com/in/devon-miller",
        "trigger": "Preparing for unexpected SOC 2 compliance vendor audit next month.",
        "funding": "$6M",
        "eng_team": 22,
    },
    {
        "company": "FinDock Automation",
        "contact": "Sarah Cho",
        "title": "Head of Engineering",
        "linkedin": "https://linkedin.com/in/sarah-cho",
        "trigger": "Expanding B2B operations into strict European enterprise markets.",
        "funding": "Bootstrapped",
        "eng_team": 6,
    },
    {
        "company": "CoreThread Software",
        "contact": "Marcus Thorne",
        "title": "VP Engineering",
        "linkedin": "https://linkedin.com/in/marcus-thorne",
        "trigger": "Rapidly shipping new dependencies via active public GitHub contributions.",
        "funding": "$1.8M",
        "eng_team": 5,
    },
]


def seed_csv(target_path="leads/leads_template.csv"):
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    headers = ["company", "contact", "title", "linkedin", "trigger", "funding", "eng_team", "status"]

    try:
        with open(target_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            for lead in LEADS_DATA:
                writer.writerow([
                    lead["company"],
                    lead["contact"],
                    lead["title"],
                    lead["linkedin"],
                    lead["trigger"],
                    lead["funding"],
                    lead["eng_team"],
                    "NEW",
                ])
        print(f"[+] Successfully seeded tracker matrix at: {target_path}")
        print("[*] 5 premium B2B startup targets loaded into active pipeline.")
    except Exception as e:
        print(f"[!] Seeding failure: {str(e)}")


if __name__ == "__main__":
    seed_csv()
