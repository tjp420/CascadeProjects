"""
A lightweight, rate-limit-safe scraper helper that builds a standardized CSV of leads.

Usage:
  python tools/scraper_helper.py --input companies.txt --out outreach/new_scraped_batch.csv --delay 2

Notes:
- This is intentionally simple and respectful: it fetches each company URL from a plaintext list and
  attempts to extract company name and website / LinkedIn links from the page. It's not a full
  crawler. Always respect site robots and terms of service.
- Requires `requests` and `beautifulsoup4`. Install with `pip install requests beautifulsoup4`.

CSV columns produced: company,contact,title,linkedin,trigger,funding,eng_team,status

The script is a convenience tool to standardize output for `tools/leads_manager.py import-csv`.
"""

import time
import argparse
import csv
import sys
from urllib.parse import urljoin, urlparse

try:
    import requests
    from bs4 import BeautifulSoup
except Exception:
    print("[!] Missing dependency: install requests and beautifulsoup4: pip install requests beautifulsoup4")
    sys.exit(1)


def extract_links(html, base_url):
    soup = BeautifulSoup(html, "html.parser")
    links = set()
    for a in soup.find_all('a', href=True):
        href = a['href'].strip()
        if href.startswith('#'):
            continue
        links.add(urljoin(base_url, href))
    return links


def guess_company_name(soup):
    # Try common meta tags
    title = None
    if soup.title and soup.title.string:
        title = soup.title.string.strip()
    meta_og = soup.find('meta', property='og:site_name') or soup.find('meta', property='og:title')
    if meta_og and meta_og.get('content'):
        return meta_og.get('content').strip()
    if title:
        return title
    # fallback
    return ''


def run(input_list, out_csv, delay=2, user_agent=None):
    headers = {"User-Agent": user_agent or "SimpleBeacon-Scraper/1.0 (+https://simplebeacon.ai)"}
    rows = []
    for url in input_list:
        url = url.strip()
        if not url:
            continue
        print(f"[+] Fetching {url}")
        try:
            r = requests.get(url, headers=headers, timeout=15)
            r.raise_for_status()
            soup = BeautifulSoup(r.text, 'html.parser')
            name = guess_company_name(soup) or urlparse(url).netloc
            links = extract_links(r.text, url)
            linkedin = ''
            website = ''
            for l in links:
                if 'linkedin.com' in l:
                    linkedin = l
                    break
            # website fallback
            website = url
            rows.append({
                'company': name,
                'contact': '',
                'title': '',
                'linkedin': linkedin,
                'trigger': 'Found via manual scrape',
                'funding': '',
                'eng_team': '',
                'status': 'NEW'
            })
        except Exception as e:
            print(f"[!] Failed to fetch {url}: {e}")
        print(f"[*] Sleeping {delay}s to respect rate limits")
        time.sleep(delay)

    # write CSV
    out_dir = out_csv.rsplit('/', 1)[0]
    if out_dir:
        import os
        os.makedirs(out_dir, exist_ok=True)
    with open(out_csv, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['company', 'contact', 'title', 'linkedin', 'trigger', 'funding', 'eng_team', 'status'])
        writer.writeheader()
        for r in rows:
            writer.writerow(r)
    print(f"[+] Wrote {len(rows)} rows to {out_csv}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--input', required=True, help='Path to plaintext file with one company URL per line')
    p.add_argument('--out', default='outreach/new_scraped_batch.csv', help='Output CSV path')
    p.add_argument('--delay', type=float, default=2.0, help='Seconds to sleep between requests')
    p.add_argument('--user-agent', help='Custom User-Agent header')
    args = p.parse_args()

    try:
        with open(args.input, 'r', encoding='utf-8') as f:
            urls = [l.strip() for l in f if l.strip()]
    except Exception as e:
        print(f"[!] Could not open input file: {e}")
        sys.exit(1)

    run(urls, args.out, delay=args.delay, user_agent=args.user_agent)


if __name__ == '__main__':
    main()
