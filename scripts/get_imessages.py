#!/usr/bin/env python3
"""
Unified script to extract iMessages and automatically join with contact names from AddressBook.
"""

import sqlite3
import datetime
import csv
import os
import re
from typing import Dict, List, Optional, Tuple

def clean_phone_number(phone: str) -> str:
    """Clean and normalize phone number for matching."""
    if not phone or phone == 'None':
        return ""
    
    # Remove all non-digit characters except +
    cleaned = re.sub(r'[^\d+]', '', str(phone))
    
    # Ensure it starts with + if it has country code
    if cleaned.startswith('1') and len(cleaned) == 11:
        cleaned = '+' + cleaned
    elif not cleaned.startswith('+') and len(cleaned) == 10:
        cleaned = '+1' + cleaned
    
    return cleaned

def get_contacts_from_addressbook(addressbook_path: str) -> Dict[str, str]:
    """
    Extract contact names and phone numbers from the AddressBook database.
    
    Returns a dictionary mapping phone numbers to contact names.
    """
    if not os.path.exists(addressbook_path):
        print(f"Warning: AddressBook database not found at {addressbook_path}")
        return {}
    
    try:
        conn = sqlite3.connect(addressbook_path)
        cursor = conn.cursor()
        
        # Query to get contact names and their phone numbers
        query = """
        SELECT 
            r.ZFIRSTNAME,
            r.ZLASTNAME,
            r.ZNAME,
            p.ZFULLNUMBER,
            p.ZLOCALNUMBER
        FROM ZABCDRECORD r
        LEFT JOIN ZABCDPHONENUMBER p ON r.Z_PK = p.ZOWNER
        WHERE p.ZFULLNUMBER IS NOT NULL OR p.ZLOCALNUMBER IS NOT NULL
        """
        
        results = cursor.execute(query).fetchall()
        phone_to_name = {}
        
        for first_name, last_name, full_name, full_number, local_number in results:
            # Determine the contact name
            contact_name = ""
            if full_name:
                contact_name = full_name
            elif first_name and last_name:
                contact_name = f"{first_name} {last_name}".strip()
            elif first_name:
                contact_name = first_name
            elif last_name:
                contact_name = last_name
            
            if not contact_name:
                continue
            
            # Process phone numbers
            phone_numbers = []
            if full_number:
                phone_numbers.append(full_number)
            if local_number and local_number != full_number:
                phone_numbers.append(local_number)
            
            # Add mappings for each phone number
            for phone in phone_numbers:
                cleaned_phone = clean_phone_number(phone)
                if cleaned_phone and len(cleaned_phone) >= 10:
                    phone_to_name[cleaned_phone] = contact_name
        
        conn.close()
        print(f"Loaded {len(phone_to_name)} phone number to name mappings from AddressBook")
        return phone_to_name
        
    except Exception as e:
        print(f"Error reading AddressBook database: {e}")
        return {}

def get_messages_for_csv(db_location: str, n: int = 1000) -> List[Dict]:
    """
    Retrieve messages from the iMessage database and format for CSV export.
    
    Returns a list of dictionaries with keys:
    - phone_number: The phone number/contact
    - is_from_me: Whether the message was sent by me (1) or received (0)
    - date: The date/time of the message
    - body: The message text content
    - group_chat_name: The name of the group chat (if applicable)
    """
    conn = sqlite3.connect(db_location)
    cursor = conn.cursor()

    query = """
    SELECT message.date, message.text, message.attributedBody, handle.id, message.is_from_me, chat.display_name
    FROM message
    LEFT JOIN handle ON message.handle_id = handle.ROWID
    LEFT JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
    LEFT JOIN chat ON chat_message_join.chat_id = chat.ROWID
    ORDER BY message.date DESC
    LIMIT ?
    """

    results = cursor.execute(query, (n,)).fetchall()
    messages = []

    for result in results:
        date, text, attributed_body, handle_id, is_from_me, group_chat_name = result

        # Determine phone number
        if handle_id is None:
            phone_number = 'Me' if is_from_me else 'Unknown'
        else:
            phone_number = handle_id

        # Extract message body
        body = None
        if text is not None:
            body = text
        elif attributed_body is not None:
            try:
                attributed_body = attributed_body.decode('utf-8', errors='replace')
                
                if "NSNumber" in str(attributed_body):
                    attributed_body = str(attributed_body).split("NSNumber")[0]
                    if "NSString" in attributed_body:
                        attributed_body = str(attributed_body).split("NSString")[1]
                        if "NSDictionary" in attributed_body:
                            attributed_body = str(attributed_body).split("NSDictionary")[0]
                            attributed_body = attributed_body[6:-12]
                            body = attributed_body
                else:
                    body = attributed_body
            except:
                body = "[Could not decode message]"
        
        if body is None:
            body = "[No message content]"

        # Convert date from Apple's format (nanoseconds since 2001-01-01)
        # to a human-readable format
        date_string = '2001-01-01 00:00:00'  # Default if conversion fails
        if date is not None:
            try:
                # Apple's epoch starts at 2001-01-01
                apple_epoch = datetime.datetime(2001, 1, 1, 0, 0, 0)
                # Date is in nanoseconds, convert to seconds
                timestamp = apple_epoch + datetime.timedelta(seconds=date/1000000000)
                date_string = timestamp.strftime('%Y-%m-%d %H:%M:%S')
            except:
                pass

        messages.append({
            'phone_number': phone_number,
            'is_from_me': is_from_me,
            'date': date_string,
            'body': body.replace('\n', ' ').replace('\r', ' ') if body else '',
            'group_chat_name': group_chat_name if group_chat_name else ''
        })

    conn.close()
    return messages

def add_contact_names_to_messages(messages: List[Dict], phone_to_name: Dict[str, str]) -> List[Dict]:
    """Add contact names to messages based on phone numbers."""
    messages_with_contacts = []
    
    for message in messages:
        phone = message.get('phone_number', '')
        is_from_me = message.get('is_from_me', '')
        group_chat_name = message.get('group_chat_name', '')
        
        # If it's from "me", use "Me"
        if str(is_from_me) == '1':
            contact_name = 'Me'
        # If it's a group chat, ignore (return empty)
        elif group_chat_name and str(group_chat_name).strip() and str(group_chat_name) != 'nan':
            contact_name = ''
        else:
            # Clean the phone number and look it up
            cleaned_phone = clean_phone_number(phone)
            contact_name = phone_to_name.get(cleaned_phone, '')
        
        # Create new message dict with contact_name first
        message_with_contact = {
            'contact_name': contact_name,
            'phone_number': phone,
            'is_from_me': is_from_me,
            'date': message.get('date', ''),
            'body': message.get('body', ''),
            'group_chat_name': group_chat_name
        }
        
        messages_with_contacts.append(message_with_contact)
    
    return messages_with_contacts

def export_to_csv(messages: List[Dict], output_file: str = 'imessages.csv'):
    """Export messages to a CSV file."""
    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['contact_name', 'phone_number', 'is_from_me', 'date', 'body', 'group_chat_name']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        writer.writeheader()
        for message in messages:
            writer.writerow(message)
    
    print(f"Exported {len(messages)} messages to {output_file}")

def main():
    # Paths to the databases
    messages_db_path = os.path.expanduser("~/Library/Messages/chat.db")
    addressbook_db_path = os.path.expanduser("~/Library/Application Support/AddressBook/AddressBook-v22.abcddb")
    
    # Check if databases exist
    if not os.path.exists(messages_db_path):
        print(f"Error: iMessage database not found at {messages_db_path}")
        print("Make sure you have the correct permissions and path.")
        return
    
    if not os.path.exists(addressbook_db_path):
        print(f"Warning: AddressBook database not found at {addressbook_db_path}")
        print("Will proceed without contact names.")
        phone_to_name = {}
    else:
        print("Loading contact names from AddressBook...")
        phone_to_name = get_contacts_from_addressbook(addressbook_db_path)
    
    # Get messages
    n = 1000
    print(f"Retrieving {n} messages from iMessage database...")
    messages = get_messages_for_csv(messages_db_path, n=n)
    print(f"Retrieved {len(messages)} messages")
    
    # Add contact names
    print("Adding contact names to messages...")
    messages_with_contacts = add_contact_names_to_messages(messages, phone_to_name)
    
    # Count how many messages got contact names
    messages_with_names = [m for m in messages_with_contacts if m['contact_name'] != '']
    print(f"Added contact names to {len(messages_with_names)} messages")
    
    # Show some examples
    print("\nSample messages with contact names:")
    sample_messages = [m for m in messages_with_contacts if m['contact_name'] != ''][:5]
    for message in sample_messages:
        print(f"  {message['contact_name']}: {message['body'][:50]}...")
    
    # Define output path within a subdirectory of the script's location
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(script_dir, 'imessage_data')
    os.makedirs(output_dir, exist_ok=True)  # Ensure the directory exists

    # Generate dynamic filename
    num_messages = len(messages_with_contacts)
    timestamp = datetime.datetime.now().strftime('%Y%m%d%H%M%S')
    filename = f'imessages_{num_messages}_{timestamp}.csv'
    output_file = os.path.join(output_dir, filename)

    export_to_csv(messages_with_contacts, output_file)
    
    # Show statistics
    print(f"\nStatistics:")
    print(f"  Total messages: {len(messages_with_contacts)}")
    print(f"  Messages with contact names: {len(messages_with_names)}")
    print(f"  Messages from 'Me': {len([m for m in messages_with_contacts if m['contact_name'] == 'Me'])}")
    print(f"  Messages from others: {len([m for m in messages_with_names if m['contact_name'] != 'Me'])}")
    print(f"  Messages without contact names: {len([m for m in messages_with_contacts if m['contact_name'] == ''])}")
    
    # Show unique contact names found
    unique_contacts = set(m['contact_name'] for m in messages_with_contacts if m['contact_name'] != '')
    print(f"\nUnique contact names found: {sorted(unique_contacts)}")
    
    print(f"\nSuccessfully exported to {output_file}")
    print(f"Columns: contact_name, phone_number, is_from_me, date, body, group_chat_name")

if __name__ == "__main__":
    main()