"""Test Jinja2 template rendering for name_title_position."""
from jinja2 import Environment, FileSystemLoader, select_autoescape
from app.models.schema import Resume, Customize
from app.services.renderer import render_html

# Test 1: Direct Jinja2 comparison
env = Environment(
    loader=FileSystemLoader('app/templates'),
    autoescape=select_autoescape(['html', 'xml']),
    auto_reload=True,
)
c = Customize(name_title_position='same-line')
print("=== Test 1: Direct Jinja2 comparison ===")
print(f"c.name_title_position = {c.name_title_position!r}")
t = env.from_string('{% if c.name_title_position == "same-line" %}ROW{% else %}COL{% endif %}')
print(f"Result: {t.render(c=c)}")

# Test 2: With default filter
t2 = env.from_string('{% if c.name_title_position | default("below") == "same-line" %}ROW{% else %}COL{% endif %}')
print(f"With default filter: {t2.render(c=c)}")

# Test 3: Full render via render_html
print("\n=== Test 2: Full render via render_html ===")
r = Resume()
r.personal.full_name = 'AAA'
r.personal.job_title = 'BBB'
r.customize.name_title_position = 'same-line'
r.modules = [{'id': 'm1', 'type': 'personal_details', 'name': 'P', 'icon': 'user', 'hidden': False, 'entries': []}]
html = render_html(r)

import re
for m in re.finditer(r'\.name-role-wrapper\s*\{([^}]+)\}', html):
    print(f"CSS: {m.group()[:200]}")
print(f"Has flex-direction: row: {'flex-direction: row' in html}")
print(f"Has flex !important: {'flex !important' in html}")

# Test 4: Via the running API
print("\n=== Test 3: Via API ===")
from urllib.request import Request, urlopen
import json
body = {
    'resume': {
        'id': 'test', 'title': 'T', 'language': 'en',
        'personal': {'full_name': 'AAA', 'job_title': 'BBB'},
        'modules': [{'id': 'm1', 'type': 'personal_details', 'name': 'P', 'icon': 'user', 'hidden': False, 'entries': []}],
        'customize': {'template': 'flowcv-style', 'name_title_position': 'same-line', 'name_size': 'S'}
    }
}
try:
    req = Request('http://localhost:8000/api/export/html',
                  data=json.dumps(body).encode(),
                  headers={'Content-Type': 'application/json'},
                  method='POST')
    api_html = urlopen(req).read().decode()
    for m in re.finditer(r'\.name-role-wrapper\s*\{([^}]+)\}', api_html):
        print(f"API CSS: {m.group()[:200]}")
    print(f"API Has flex-direction: row: {'flex-direction: row' in api_html}")
    print(f"API Has flex !important: {'flex !important' in api_html}")
except Exception as e:
    print(f"API error: {e}")
