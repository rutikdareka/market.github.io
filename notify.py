import requests
from pushbullet import Pushbullet

# Pushbullet API Key
API_KEY = "o.rPzjmQqA9P15fvbPlCmwcHhVQmEjwIYZ"

# CNBC TV18 Market Page URL
URL = "https://www.cnbctv18.com/market/"

def parse_html_notifications(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            html_content = file.read()
        
        notifications = []
        lines = html_content.splitlines()
        
        current_title = None
        current_body = ""
        in_notification = False

        for line in lines:
            line = line.strip()
            
            # Look for div with class="notification" and data-title
            if '<div class="notification"' in line:
                in_notification = True
                start_idx = line.find('data-title="') + len('data-title="')
                end_idx = line.find('"', start_idx)
                if start_idx != -1 and end_idx != -1:
                    current_title = line[start_idx:end_idx]
                current_body = ""
            
            # Extract paragraph text
            elif in_notification and '<p>' in line:
                start_idx = line.find('<p>') + 3
                end_idx = line.find('</p>')
                if start_idx != -1 and end_idx != -1:
                    current_body += line[start_idx:end_idx].strip()
            
            # Extract link from <a> tag
            elif in_notification and '<a href="' in line:
                start_idx = line.find('href="') + 6
                end_idx = line.find('"', start_idx)
                if start_idx != -1 and end_idx != -1:
                    current_body += f"\nLink: {line[start_idx:end_idx]}"
            
            # End of notification div
            elif in_notification and '</div>' in line:
                if current_title:
                    notifications.append({"title": current_title, "body": current_body})
                in_notification = False
                current_title = None
                current_body = ""

        return notifications
    except Exception as e:
        print(f"Error parsing HTML: {e}")
        return []

def get_latest_articles():
    try:
        response = requests.get(URL)
        response.raise_for_status()  # Check for HTTP errors
        html_content = response.text
        
        notifications = []
        lines = html_content.splitlines()
        
        for line in lines:
            line = line.strip()
            # Look for h3 tags with a specific class (adjust class as needed)
            if '<h3 class="jsx-3523802742">' in line:  # Adjust class based on CNBC structure
                start_idx = line.find('>') + 1
                end_idx = line.find('</h3>')
                if start_idx != -1 and end_idx != -1:
                    title = line[start_idx:end_idx].strip()
                    # Find the parent <a> tag for the link (simplified assumption)
                    link_start = html_content.find('<a href="', html_content.find(line))
                    link_end = html_content.find('"', link_start + 9)
                    if link_start != -1 and link_end != -1:
                        link = html_content[link_start + 9:link_end]
                        notifications.append({"title": "Latest Market News: " + title, "body": f"Link: {link}"})
        
        return notifications[:3]  # Return top 3 articles
    except Exception as e:
        print(f"Error fetching articles: {e}")
        return []

def send_notifications(notifications_list):
    pb = Pushbullet(API_KEY)
    for noti in notifications_list:
        try:
            pb.push_note(noti["title"], noti["body"])
            print("Notification Sent:", noti["title"])
        except Exception as e:
            print(f"Error sending notification: {e}")

if __name__ == "__main__":
    # Parse notifications from HTML file
    html_notifications = parse_html_notifications("push.html")
    
    # Get latest articles from CNBC
    web_notifications = get_latest_articles()
    
    # Combine both sources
    all_notifications = html_notifications + web_notifications
    
    if all_notifications:
        send_notifications(all_notifications)
    else:
        print("No notifications found!")
