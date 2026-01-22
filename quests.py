import os
import re
from supabase import create_client, Client
from html import escape
import urllib.request
import urllib.error

# Configuration
SUPABASE_URL = 'https://jrjgbnopmfovxwvtbivh.supabase.co';
SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impyamdibm9wbWZvdnh3dnRiaXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgxOTg1MjYsImV4cCI6MjAyMzc3NDUyNn0.za7oUzFhNmBdtcCRBmxwW5FSTFRWVAY6_rsRwlr3iqY';

PLACEHOLDER_IMAGE = "https://yesitsphoenix.github.io/Pax-Dei-Archives/frontend/www/assets/petra_dei_stone.png"
OUTPUT_DIR = "quests"
QUEST_IMAGES_DIR = "frontend/www/assets/quests"
DOWNLOAD_IMAGES = False 

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

def strip_markdown_and_html(text):
    """Strip markdown and HTML tags from text"""
    if not text:
        return ""
    
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', ' ', text)
    
    # Remove markdown image syntax
    text = re.sub(r'!\[.*?\]\(.*?\)', '', text)
    
    # Remove markdown links but keep text
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    
    # Remove markdown headers
    text = re.sub(r'#+\s*', '', text)
    
    # Remove bold/italic
    text = re.sub(r'\*\*([^\*]+)\*\*', r'\1', text)
    text = re.sub(r'\*([^\*]+)\*', r'\1', text)
    
    # Remove blockquotes
    text = re.sub(r'>\s*', '', text)
    
    # Clean up whitespace
    text = ' '.join(text.split())
    
    return text.strip()

def download_image(url, filename):
    """Download an image from a URL to the local quest images directory"""
    try:
        filepath = os.path.join(QUEST_IMAGES_DIR, filename)
        
        # Skip if file already exists
        if os.path.exists(filepath):
            print(f"   Image already exists: {filename}")
            return True
        
        # Download the image
        urllib.request.urlretrieve(url, filepath)
        print(f"   Downloaded: {filename}")
        return True
    except urllib.error.URLError as e:
        print(f"   ⚠️  Failed to download {url}: {e}")
        return False
    except Exception as e:
        print(f"   ⚠️  Error downloading {url}: {e}")
        return False

def extract_first_image(lore, quest_key):
    """Extract the first image URL from markdown lore and convert to GitHub Pages URL"""
    if not lore:
        return None
    
    # Match markdown image syntax: ![alt](url)
    match = re.search(r'!\[.*?\]\((https?://[^\)]+)\)', lore)
    if not match:
        # Match HTML img tags: <img src="url"
        match = re.search(r'<img[^>]+src=["\'](https?://[^"\']+)["\']', lore)
    
    if match:
        image_url = match.group(1)
        
        # If it's a postimg.cc URL, convert to GitHub Pages hosted version
        if 'postimg.cc' in image_url:
            # Extract filename from postimg URL (e.g., bronze_heater.png)
            filename_match = re.search(r'/([^/]+\.(?:png|jpg|jpeg|gif|webp))$', image_url, re.IGNORECASE)
            if filename_match:
                filename = filename_match.group(1)
                
                # Download image if enabled
                if DOWNLOAD_IMAGES:
                    download_image(image_url, filename)
                
                # Return GitHub Pages URL
                return f"https://yesitsphoenix.github.io/Pax-Dei-Archives/{QUEST_IMAGES_DIR}/{filename}"
        
        return image_url
    
    return None

def truncate_description(text, max_length=150):
    """Truncate text to max_length characters, ending at a word boundary"""
    if len(text) <= max_length:
        return text
    
    truncated = text[:max_length]
    last_space = truncated.rfind(' ')
    
    if last_space > 0:
        truncated = truncated[:last_space]
    
    return truncated + "..."

def generate_quest_html(quest):
    """Generate HTML file for a single quest"""
    quest_name = quest['quest_name']
    quest_key = quest['quest_key']
    lore = quest.get('lore', '')
    
    # Extract description (first ~150 chars of lore without markdown)
    clean_lore = strip_markdown_and_html(lore)
    description = truncate_description(clean_lore, 150)
    
    # Extract image or use placeholder
    image_url = extract_first_image(lore, quest_key) or PLACEHOLDER_IMAGE
    
    # Generate quest page URL
    quest_url = f"https://yesitsphoenix.github.io/Pax-Dei-Archives/quests/{quest_key}.html"
    
    html_content = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{escape(quest_name)} - Quest Details</title>
    
    <!-- Open Graph / Facebook -->
    <meta property="og:site_name" content="Pax Dei Archives" />
    <meta property="og:title" content="{escape(quest_name)}" />
    <meta property="og:description" content="{escape(description)}" />
    <meta property="og:image" content="{escape(image_url)}" />
    <meta property="og:url" content="{quest_url}" />
    <meta property="og:type" content="website" />
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{escape(quest_name)}" />
    <meta name="twitter:description" content="{escape(description)}" />
    <meta name="twitter:image" content="{escape(image_url)}" />
    
    <!-- Theme -->
    <meta name="theme-color" content="#FACC15" />
    
    <!-- Redirect to main quests page with quest parameter -->
    <script>
        window.location.href = "https://yesitsphoenix.github.io/Pax-Dei-Archives/quests.html?quest={escape(quest_key)}";
    </script>
</head>
<body>
    <p>Redirecting to <a href="https://yesitsphoenix.github.io/Pax-Dei-Archives/quests.html?quest={escape(quest_key)}">{escape(quest_name)}</a>...</p>
</body>
</html>'''
    
    return html_content

def main():
    print("Fetching quests from Supabase...")
    
    # Fetch all active quests
    response = supabase.table('cipher_quests').select('*').eq('active', True).execute()
    quests = response.data
    
    print(f"Found {len(quests)} active quests")
    
    # Create output directory if it doesn't exist
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        print(f"Created directory: {OUTPUT_DIR}/")
    
    # Create quest images directory if downloading images
    if DOWNLOAD_IMAGES and not os.path.exists(QUEST_IMAGES_DIR):
        os.makedirs(QUEST_IMAGES_DIR)
        print(f"Created directory: {QUEST_IMAGES_DIR}/")
    
    # Generate HTML files
    generated_count = 0
    for quest in quests:
        quest_key = quest['quest_key']
        
        if not quest_key:
            print(f"⚠️  Skipping quest without quest_key: {quest.get('quest_name', 'Unknown')}")
            continue
        
        html_content = generate_quest_html(quest)
        filename = f"{quest_key}.html"
        filepath = os.path.join(OUTPUT_DIR, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        generated_count += 1
        print(f"✓ Generated: {filename}")
    
    print(f"\n✅ Successfully generated {generated_count} quest HTML files in '{OUTPUT_DIR}/' directory")
    
    if DOWNLOAD_IMAGES:
        print(f"\n📥 Images downloaded to '{QUEST_IMAGES_DIR}/' directory")
        print(f"   Make sure to commit and push this folder to GitHub!")
    else:
        print(f"\n💡 Tip: Set DOWNLOAD_IMAGES = True to download images from postimg.cc to local folder")
    
    print(f"\nNext steps:")
    print(f"1. Upload the '{OUTPUT_DIR}/' folder to your GitHub repository")
    if DOWNLOAD_IMAGES:
        print(f"2. Upload the '{QUEST_IMAGES_DIR}/' folder to your GitHub repository")
        print(f"3. Quest links will work as: https://yesitsphoenix.github.io/Pax-Dei-Archives/quests/QUEST-KEY.html")
    else:
        print(f"2. Quest links will work as: https://yesitsphoenix.github.io/Pax-Dei-Archives/quests/QUEST-KEY.html")

if __name__ == "__main__":
    main()
