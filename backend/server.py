from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
import httpx
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Expo Push Notification URL
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Helper function to convert ObjectId to string
def serialize_doc(doc):
    if doc is None:
        return None
    doc['id'] = str(doc['_id'])
    del doc['_id']
    return doc

# ==================== MODELS ====================

class IngredientBase(BaseModel):
    name: str
    quantity: float
    unit: str  # grams, liters, pieces

class IngredientWithStore(BaseModel):
    name: str
    quantity: float
    unit: str
    store: Optional[str] = "Any Store"

class RecipeCreate(BaseModel):
    name: str
    ingredients: List[IngredientBase]

class RecipeUpdate(BaseModel):
    name: Optional[str] = None
    ingredients: Optional[List[IngredientBase]] = None

class RecipeResponse(BaseModel):
    id: str
    name: str
    ingredients: List[IngredientBase]
    created_at: datetime
    updated_at: datetime

class HomeStockItemCreate(BaseModel):
    name: str
    quantity: float
    unit: str  # grams, liters, pieces
    safety_stock: float = 0
    location: str = "Uncategorized"

class HomeStockItemUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    safety_stock: Optional[float] = None
    location: Optional[str] = None

class HomeStockItemResponse(BaseModel):
    id: str
    name: str
    quantity: float
    unit: str
    safety_stock: float
    location: str = "Uncategorized"
    created_at: datetime
    updated_at: datetime

class EmergencyStockItemCreate(BaseModel):
    name: str
    quantity: float
    unit: str
    expiration_date: datetime

class EmergencyStockItemUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    expiration_date: Optional[datetime] = None

class EmergencyStockItemResponse(BaseModel):
    id: str
    name: str
    quantity: float
    unit: str
    expiration_date: datetime
    created_at: datetime
    updated_at: datetime

class ShoppingListItemCreate(BaseModel):
    name: str
    quantity: float
    unit: str
    location: str = "Uncategorized"
    store: str = "Any Store"

class ShoppingListItemUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    checked: Optional[bool] = None
    location: Optional[str] = None
    store: Optional[str] = None

class ShoppingListItemResponse(BaseModel):
    id: str
    name: str
    quantity: float
    unit: str
    checked: bool
    location: str = "Uncategorized"
    store: str = "Any Store"
    created_at: datetime
    updated_at: datetime

class IngredientLocationChoice(BaseModel):
    ingredient_name: str
    item_id: str  # The specific home_stock item ID to use

class CookRecipeRequest(BaseModel):
    recipe_id: str
    use_emergency_stock: bool = False
    location_choices: Optional[List[IngredientLocationChoice]] = None  # NEW: specific location choices

class QuickAddRequest(BaseModel):
    item_id: str
    quantity_change: float  # positive or negative

# ==================== USER & HOUSEHOLD MODELS ====================

import secrets
import hashlib

def generate_invite_code():
    """Generate a unique 8-character invite code"""
    return secrets.token_urlsafe(6)[:8].upper()

def hash_pin(pin: str) -> str:
    """Simple hash for PIN storage"""
    return hashlib.sha256(pin.encode()).hexdigest()

class UserRegister(BaseModel):
    username: str
    pin: str  # 4-digit PIN
    role: str = "adult"  # "adult" or "child"

class UserLogin(BaseModel):
    username: str
    pin: str

class UserResponse(BaseModel):
    id: str
    username: str
    role: str = "adult"
    household_id: Optional[str] = None
    created_at: datetime

class HouseholdCreate(BaseModel):
    name: str

class HouseholdJoin(BaseModel):
    invite_code: str

# ==================== PUSH NOTIFICATION MODELS ====================

class PushTokenRegister(BaseModel):
    user_id: str
    push_token: str

class NotificationSettings(BaseModel):
    emergency_alerts_enabled: bool = True

# ==================== DINNER WISHES MODELS ====================

class DinnerWishCreate(BaseModel):
    recipe_id: str
    recipe_name: str

class DinnerWishResponse(BaseModel):
    id: str
    user_id: str
    username: str
    recipe_id: str
    recipe_name: str
    status: str  # "pending" or "approved"
    household_id: str
    created_at: datetime

MAX_PENDING_WISHES = 7  # Maximum pending wishes per child

async def send_push_notification(push_token: str, title: str, body: str, data: dict = None):
    """Send a push notification via Expo's push service"""
    message = {
        "to": push_token,
        "sound": "default",
        "title": title,
        "body": body,
        "data": data or {}
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                EXPO_PUSH_URL,
                json=message,
                headers={"Content-Type": "application/json"}
            )
            return response.json()
    except Exception as e:
        logging.error(f"Failed to send push notification: {e}")
        return None

async def check_and_send_expiration_alerts():
    """Check emergency stock for expiring items and send notifications"""
    today = datetime.utcnow().date()
    alert_days = [30, 14, 7]
    
    # Get all emergency stock items
    items = await db.emergency_stock.find().to_list(1000)
    
    for item in items:
        if 'expiration_date' not in item:
            continue
            
        exp_date = item['expiration_date']
        if isinstance(exp_date, str):
            exp_date = datetime.fromisoformat(exp_date.replace('Z', '+00:00')).date()
        elif isinstance(exp_date, datetime):
            exp_date = exp_date.date()
        
        days_left = (exp_date - today).days
        
        # Check if days_left matches any alert threshold
        if days_left in alert_days:
            # Get household_id for this item (if exists)
            household_id = item.get('household_id')
            
            # Find all users in this household (or all users if no household)
            if household_id:
                users = await db.users.find({"household_id": household_id}).to_list(100)
            else:
                # If item has no household, skip notifications
                continue
            
            # Get emoji based on urgency
            if days_left == 7:
                emoji = "🚨"
            elif days_left == 14:
                emoji = "⚠️"
            else:
                emoji = "📅"
            
            # Send notification to each user with a push token
            for user in users:
                # Check if user has notifications enabled
                settings = await db.notification_settings.find_one({"user_id": str(user['_id'])})
                if settings and not settings.get('emergency_alerts_enabled', True):
                    continue
                
                # Get push token
                token_doc = await db.push_tokens.find_one({"user_id": str(user['_id'])})
                if not token_doc:
                    continue
                
                title = f"{emoji} Emergency Stock Alert"
                body = f'"{item["name"]}" - from Emergency expires in {days_left} days!'
                
                await send_push_notification(
                    token_doc['push_token'],
                    title,
                    body,
                    {"item_id": str(item['_id']), "days_left": days_left}
                )
                
                logging.info(f"Sent expiration alert for {item['name']} to user {user['username']}")

# ==================== PUSH NOTIFICATION ENDPOINTS ====================

@api_router.post("/push-token/register")
async def register_push_token(data: PushTokenRegister):
    """Register or update a user's push token"""
    now = datetime.utcnow()
    
    # Upsert the push token
    await db.push_tokens.update_one(
        {"user_id": data.user_id},
        {
            "$set": {
                "push_token": data.push_token,
                "updated_at": now
            },
            "$setOnInsert": {
                "created_at": now
            }
        },
        upsert=True
    )
    
    return {"message": "Push token registered successfully"}

@api_router.delete("/push-token/{user_id}")
async def delete_push_token(user_id: str):
    """Remove a user's push token (for logout)"""
    await db.push_tokens.delete_one({"user_id": user_id})
    return {"message": "Push token removed"}

@api_router.get("/notification-settings/{user_id}")
async def get_notification_settings(user_id: str):
    """Get notification settings for a user"""
    settings = await db.notification_settings.find_one({"user_id": user_id})
    if not settings:
        return {"emergency_alerts_enabled": True}
    return {"emergency_alerts_enabled": settings.get('emergency_alerts_enabled', True)}

@api_router.put("/notification-settings/{user_id}")
async def update_notification_settings(user_id: str, settings: NotificationSettings):
    """Update notification settings for a user"""
    now = datetime.utcnow()
    
    await db.notification_settings.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "emergency_alerts_enabled": settings.emergency_alerts_enabled,
                "updated_at": now
            },
            "$setOnInsert": {
                "created_at": now
            }
        },
        upsert=True
    )
    
    return {"message": "Settings updated", "emergency_alerts_enabled": settings.emergency_alerts_enabled}

@api_router.post("/notifications/check-expirations")
async def trigger_expiration_check(background_tasks: BackgroundTasks):
    """Manually trigger expiration check (for testing or cron jobs)"""
    background_tasks.add_task(check_and_send_expiration_alerts)
    return {"message": "Expiration check started"}

@api_router.post("/notifications/test/{user_id}")
async def send_test_notification(user_id: str):
    """Send a test notification to verify push setup"""
    token_doc = await db.push_tokens.find_one({"user_id": user_id})
    if not token_doc:
        raise HTTPException(status_code=404, detail="No push token registered for this user")
    
    result = await send_push_notification(
        token_doc['push_token'],
        "🧪 Test Notification",
        "Push notifications are working!",
        {"test": True}
    )
    
    return {"message": "Test notification sent", "result": result}

class HouseholdResponse(BaseModel):
    id: str
    name: str
    invite_code: str
    members: List[dict]
    created_at: datetime

class HouseholdMember(BaseModel):
    user_id: str
    username: str
    joined_at: datetime

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register")
async def register_user(user: UserRegister):
    """Register a new user with username and 4-digit PIN"""
    if len(user.pin) != 4 or not user.pin.isdigit():
        raise HTTPException(status_code=400, detail="PIN must be exactly 4 digits")
    
    if len(user.username) < 2:
        raise HTTPException(status_code=400, detail="Username must be at least 2 characters")
    
    # Validate role
    if user.role not in ["adult", "child"]:
        raise HTTPException(status_code=400, detail="Role must be 'adult' or 'child'")
    
    # Check if username exists
    existing = await db.users.find_one({"username": user.username.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    now = datetime.utcnow()
    user_doc = {
        "username": user.username,
        "username_lower": user.username.lower(),
        "pin_hash": hash_pin(user.pin),
        "role": user.role,
        "household_id": None,
        "created_at": now,
        "updated_at": now
    }
    
    result = await db.users.insert_one(user_doc)
    user_doc['_id'] = result.inserted_id
    
    return {
        "id": str(result.inserted_id),
        "username": user.username,
        "role": user.role,
        "household_id": None,
        "created_at": now
    }

@api_router.post("/auth/login")
async def login_user(user: UserLogin):
    """Login with username and PIN"""
    db_user = await db.users.find_one({"username_lower": user.username.lower()})
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid username or PIN")
    
    if db_user['pin_hash'] != hash_pin(user.pin):
        raise HTTPException(status_code=401, detail="Invalid username or PIN")
    
    return {
        "id": str(db_user['_id']),
        "username": db_user['username'],
        "role": db_user.get('role', 'adult'),  # Default to adult for existing users
        "household_id": db_user.get('household_id'),
        "created_at": db_user['created_at']
    }

@api_router.get("/auth/user/{user_id}")
async def get_user(user_id: str):
    """Get user info by ID"""
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": str(user['_id']),
        "username": user['username'],
        "household_id": user.get('household_id'),
        "created_at": user['created_at']
    }

# ==================== HOUSEHOLD ENDPOINTS ====================

@api_router.post("/household/create")
async def create_household(data: HouseholdCreate, user_id: str):
    """Create a new household and add the creator as first member"""
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get('household_id'):
        raise HTTPException(status_code=400, detail="User already belongs to a household")
    
    now = datetime.utcnow()
    invite_code = generate_invite_code()
    
    # Check invite code uniqueness
    while await db.households.find_one({"invite_code": invite_code}):
        invite_code = generate_invite_code()
    
    household_doc = {
        "name": data.name,
        "invite_code": invite_code,
        "members": [{
            "user_id": str(user['_id']),
            "username": user['username'],
            "joined_at": now,
            "is_owner": True
        }],
        "created_at": now,
        "updated_at": now
    }
    
    result = await db.households.insert_one(household_doc)
    household_id = str(result.inserted_id)
    
    # Update user with household_id
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"household_id": household_id, "updated_at": now}}
    )
    
    # Migrate user's existing data to the household
    await migrate_data_to_household(user_id, household_id)
    
    return {
        "id": household_id,
        "name": data.name,
        "invite_code": invite_code,
        "members": household_doc['members'],
        "created_at": now
    }

@api_router.post("/household/join")
async def join_household(data: HouseholdJoin, user_id: str):
    """Join an existing household using invite code"""
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get('household_id'):
        raise HTTPException(status_code=400, detail="User already belongs to a household. Leave first to join another.")
    
    household = await db.households.find_one({"invite_code": data.invite_code.upper()})
    if not household:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    
    now = datetime.utcnow()
    household_id = str(household['_id'])
    
    # Add user to household members
    new_member = {
        "user_id": str(user['_id']),
        "username": user['username'],
        "joined_at": now,
        "is_owner": False
    }
    
    await db.households.update_one(
        {"_id": household['_id']},
        {
            "$push": {"members": new_member},
            "$set": {"updated_at": now}
        }
    )
    
    # Update user with household_id
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"household_id": household_id, "updated_at": now}}
    )
    
    # Migrate user's existing data to the household (merge)
    await migrate_data_to_household(user_id, household_id)
    
    # Fetch updated household
    updated_household = await db.households.find_one({"_id": household['_id']})
    
    return {
        "id": household_id,
        "name": updated_household['name'],
        "invite_code": updated_household['invite_code'],
        "members": updated_household['members'],
        "created_at": updated_household['created_at']
    }

@api_router.get("/household/{user_id}")
async def get_household(user_id: str):
    """Get household info for a user"""
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.get('household_id'):
        return {"household": None}
    
    household = await db.households.find_one({"_id": ObjectId(user['household_id'])})
    if not household:
        return {"household": None}
    
    return {
        "id": str(household['_id']),
        "name": household['name'],
        "invite_code": household['invite_code'],
        "members": household['members'],
        "created_at": household['created_at']
    }

@api_router.post("/household/leave/{user_id}")
async def leave_household(user_id: str):
    """Leave the current household"""
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.get('household_id'):
        raise HTTPException(status_code=400, detail="User is not in a household")
    
    household = await db.households.find_one({"_id": ObjectId(user['household_id'])})
    if not household:
        raise HTTPException(status_code=404, detail="Household not found")
    
    now = datetime.utcnow()
    
    # Remove user from household members
    await db.households.update_one(
        {"_id": household['_id']},
        {
            "$pull": {"members": {"user_id": user_id}},
            "$set": {"updated_at": now}
        }
    )
    
    # Update user to remove household_id
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"household_id": None, "updated_at": now}}
    )
    
    # Check if household is now empty, delete it
    updated_household = await db.households.find_one({"_id": household['_id']})
    if updated_household and len(updated_household.get('members', [])) == 0:
        await db.households.delete_one({"_id": household['_id']})
    
    return {"message": "Successfully left household"}

async def migrate_data_to_household(user_id: str, household_id: str):
    """Migrate a user's existing data to a household (for sharing)"""
    now = datetime.utcnow()
    
    # Update all home_stock items that don't have a household_id yet
    await db.home_stock.update_many(
        {"household_id": {"$exists": False}},
        {"$set": {"household_id": household_id, "updated_at": now}}
    )
    
    # Update all emergency_stock items
    await db.emergency_stock.update_many(
        {"household_id": {"$exists": False}},
        {"$set": {"household_id": household_id, "updated_at": now}}
    )
    
    # Update all recipes
    await db.recipes.update_many(
        {"household_id": {"$exists": False}},
        {"$set": {"household_id": household_id, "updated_at": now}}
    )
    
    # Update all shopping_list items
    await db.shopping_list.update_many(
        {"household_id": {"$exists": False}},
        {"$set": {"household_id": household_id, "updated_at": now}}
    )
    
    # Update locations
    await db.locations.update_many(
        {"household_id": {"$exists": False}},
        {"$set": {"household_id": household_id, "updated_at": now}}
    )

# ==================== HOME STOCK ENDPOINTS ====================

@api_router.get("/home-stock", response_model=List[HomeStockItemResponse])
async def get_home_stock(household_id: Optional[str] = None):
    query = {}
    if household_id:
        query["household_id"] = household_id
    items = await db.home_stock.find(query).to_list(1000)
    result = []
    for item in items:
        doc = serialize_doc(item)
        # Add default location for items that don't have it
        if 'location' not in doc:
            doc['location'] = 'Uncategorized'
        result.append(HomeStockItemResponse(**doc))
    return result

@api_router.post("/home-stock", response_model=HomeStockItemResponse)
async def create_home_stock_item(item: HomeStockItemCreate, household_id: Optional[str] = None):
    now = datetime.utcnow()
    item_dict = item.dict()
    item_dict['created_at'] = now
    item_dict['updated_at'] = now
    if household_id:
        item_dict['household_id'] = household_id
    result = await db.home_stock.insert_one(item_dict)
    created = await db.home_stock.find_one({"_id": result.inserted_id})
    return HomeStockItemResponse(**serialize_doc(created))

@api_router.get("/home-stock/{item_id}", response_model=HomeStockItemResponse)
async def get_home_stock_item(item_id: str):
    item = await db.home_stock.find_one({"_id": ObjectId(item_id)})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return HomeStockItemResponse(**serialize_doc(item))

@api_router.put("/home-stock/{item_id}", response_model=HomeStockItemResponse)
async def update_home_stock_item(item_id: str, item: HomeStockItemUpdate):
    update_data = {k: v for k, v in item.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    update_data['updated_at'] = datetime.utcnow()
    await db.home_stock.update_one({"_id": ObjectId(item_id)}, {"$set": update_data})
    updated = await db.home_stock.find_one({"_id": ObjectId(item_id)})
    if not updated:
        raise HTTPException(status_code=404, detail="Item not found")
    return HomeStockItemResponse(**serialize_doc(updated))

@api_router.delete("/home-stock/{item_id}")
async def delete_home_stock_item(item_id: str):
    result = await db.home_stock.delete_one({"_id": ObjectId(item_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted successfully"}

@api_router.post("/home-stock/quick-add")
async def quick_add_home_stock(request: QuickAddRequest):
    item = await db.home_stock.find_one({"_id": ObjectId(request.item_id)})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    new_quantity = max(0, item['quantity'] + request.quantity_change)
    await db.home_stock.update_one(
        {"_id": ObjectId(request.item_id)},
        {"$set": {"quantity": new_quantity, "updated_at": datetime.utcnow()}}
    )
    
    updated = await db.home_stock.find_one({"_id": ObjectId(request.item_id)})
    return HomeStockItemResponse(**serialize_doc(updated))

@api_router.get("/home-stock/locations")
async def get_home_stock_locations():
    """Get all unique locations from home stock items"""
    items = await db.home_stock.find().to_list(1000)
    locations = set()
    for item in items:
        loc = item.get('location', 'Uncategorized')
        locations.add(loc)
    return {"locations": sorted(list(locations))}

@api_router.post("/home-stock/locations")
async def create_location(location: dict):
    """Store a new location (for persistence even when empty)"""
    existing = await db.locations.find_one({"name": location.get("name")})
    if existing:
        return {"message": "Location already exists", "name": location.get("name")}
    
    await db.locations.insert_one({
        "name": location.get("name"),
        "created_at": datetime.utcnow()
    })
    return {"message": "Location created", "name": location.get("name")}

@api_router.get("/locations")
async def get_all_locations():
    """Get all stored locations"""
    # Get locations from both the locations collection and from items
    stored = await db.locations.find().to_list(100)
    items = await db.home_stock.find().to_list(1000)
    
    locations = set(["Uncategorized"])  # Always include Uncategorized
    for loc in stored:
        locations.add(loc.get('name'))
    for item in items:
        loc = item.get('location', 'Uncategorized')
        locations.add(loc)
    
    return {"locations": sorted(list(locations))}

@api_router.put("/locations/{old_name}")
async def rename_location(old_name: str, data: dict):
    """Rename a location - updates all items with that location"""
    new_name = data.get("name")
    if not new_name:
        raise HTTPException(status_code=400, detail="New name is required")
    
    if old_name == "Uncategorized":
        raise HTTPException(status_code=400, detail="Cannot rename Uncategorized")
    
    # Update all items with this location
    result = await db.home_stock.update_many(
        {"location": old_name},
        {"$set": {"location": new_name, "updated_at": datetime.utcnow()}}
    )
    
    # Update the location in locations collection if it exists
    await db.locations.update_one(
        {"name": old_name},
        {"$set": {"name": new_name}},
        upsert=True
    )
    
    # Delete old location entry if different name
    if old_name != new_name:
        await db.locations.delete_one({"name": old_name})
    
    return {
        "message": f"Renamed '{old_name}' to '{new_name}'",
        "items_updated": result.modified_count
    }

@api_router.delete("/locations/{name}")
async def delete_location(name: str):
    """Delete a location - moves all items to Uncategorized"""
    if name == "Uncategorized":
        raise HTTPException(status_code=400, detail="Cannot delete Uncategorized")
    
    # Move all items to Uncategorized
    result = await db.home_stock.update_many(
        {"location": name},
        {"$set": {"location": "Uncategorized", "updated_at": datetime.utcnow()}}
    )
    
    # Delete the location
    await db.locations.delete_one({"name": name})
    
    return {
        "message": f"Deleted location '{name}'",
        "items_moved": result.modified_count
    }

# ==================== EMERGENCY STOCK ENDPOINTS ====================

@api_router.get("/emergency-stock", response_model=List[EmergencyStockItemResponse])
async def get_emergency_stock(household_id: Optional[str] = None):
    query = {}
    if household_id:
        query["household_id"] = household_id
    items = await db.emergency_stock.find(query).sort("expiration_date", 1).to_list(1000)
    return [EmergencyStockItemResponse(**serialize_doc(item)) for item in items]

@api_router.post("/emergency-stock", response_model=EmergencyStockItemResponse)
async def create_emergency_stock_item(item: EmergencyStockItemCreate, household_id: Optional[str] = None):
    now = datetime.utcnow()
    item_dict = item.dict()
    item_dict['created_at'] = now
    item_dict['updated_at'] = now
    if household_id:
        item_dict['household_id'] = household_id
    result = await db.emergency_stock.insert_one(item_dict)
    created = await db.emergency_stock.find_one({"_id": result.inserted_id})
    return EmergencyStockItemResponse(**serialize_doc(created))

@api_router.get("/emergency-stock/{item_id}", response_model=EmergencyStockItemResponse)
async def get_emergency_stock_item(item_id: str):
    item = await db.emergency_stock.find_one({"_id": ObjectId(item_id)})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return EmergencyStockItemResponse(**serialize_doc(item))

@api_router.put("/emergency-stock/{item_id}", response_model=EmergencyStockItemResponse)
async def update_emergency_stock_item(item_id: str, item: EmergencyStockItemUpdate):
    update_data = {k: v for k, v in item.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    update_data['updated_at'] = datetime.utcnow()
    await db.emergency_stock.update_one({"_id": ObjectId(item_id)}, {"$set": update_data})
    updated = await db.emergency_stock.find_one({"_id": ObjectId(item_id)})
    if not updated:
        raise HTTPException(status_code=404, detail="Item not found")
    return EmergencyStockItemResponse(**serialize_doc(updated))

@api_router.delete("/emergency-stock/{item_id}")
async def delete_emergency_stock_item(item_id: str):
    result = await db.emergency_stock.delete_one({"_id": ObjectId(item_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted successfully"}

# ==================== RECIPE ENDPOINTS ====================

@api_router.get("/recipes", response_model=List[RecipeResponse])
async def get_recipes(household_id: Optional[str] = None):
    query = {}
    if household_id:
        query["household_id"] = household_id
    recipes = await db.recipes.find(query).to_list(1000)
    return [RecipeResponse(**serialize_doc(recipe)) for recipe in recipes]

@api_router.post("/recipes", response_model=RecipeResponse)
async def create_recipe(recipe: RecipeCreate, household_id: Optional[str] = None):
    now = datetime.utcnow()
    recipe_dict = recipe.dict()
    recipe_dict['created_at'] = now
    recipe_dict['updated_at'] = now
    if household_id:
        recipe_dict['household_id'] = household_id
    result = await db.recipes.insert_one(recipe_dict)
    created = await db.recipes.find_one({"_id": result.inserted_id})
    return RecipeResponse(**serialize_doc(created))

@api_router.get("/recipes/{recipe_id}", response_model=RecipeResponse)
async def get_recipe(recipe_id: str):
    recipe = await db.recipes.find_one({"_id": ObjectId(recipe_id)})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return RecipeResponse(**serialize_doc(recipe))

@api_router.put("/recipes/{recipe_id}", response_model=RecipeResponse)
async def update_recipe(recipe_id: str, recipe: RecipeUpdate):
    update_data = {k: v for k, v in recipe.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    if 'ingredients' in update_data:
        update_data['ingredients'] = [ing.dict() if hasattr(ing, 'dict') else ing for ing in update_data['ingredients']]
    update_data['updated_at'] = datetime.utcnow()
    await db.recipes.update_one({"_id": ObjectId(recipe_id)}, {"$set": update_data})
    updated = await db.recipes.find_one({"_id": ObjectId(recipe_id)})
    if not updated:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return RecipeResponse(**serialize_doc(updated))

@api_router.delete("/recipes/{recipe_id}")
async def delete_recipe(recipe_id: str):
    result = await db.recipes.delete_one({"_id": ObjectId(recipe_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return {"message": "Recipe deleted successfully"}

@api_router.get("/recipes/{recipe_id}/availability")
async def check_recipe_availability(recipe_id: str):
    recipe = await db.recipes.find_one({"_id": ObjectId(recipe_id)})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    home_stock = await db.home_stock.find().to_list(1000)
    emergency_stock = await db.emergency_stock.find().to_list(1000)
    
    # Group home stock items by name (case insensitive) - keep ALL items, not just one
    home_stock_by_name = {}
    for item in home_stock:
        name_lower = item['name'].lower()
        if name_lower not in home_stock_by_name:
            home_stock_by_name[name_lower] = []
        home_stock_by_name[name_lower].append(item)
    
    emergency_stock_map = {item['name'].lower(): item for item in emergency_stock}
    
    availability = []
    for ingredient in recipe['ingredients']:
        ing_name = ingredient['name'].lower()
        home_items = home_stock_by_name.get(ing_name, [])
        emergency_item = emergency_stock_map.get(ing_name)
        
        status = "missing"
        total_available = sum(item['quantity'] for item in home_items)
        safety_stock = home_items[0].get('safety_stock', 0) if home_items else 0
        in_emergency = False
        
        # Build locations array with availability info
        locations = []
        for item in home_items:
            loc = item.get('location', 'Uncategorized')
            locations.append({
                "location": loc,
                "item_id": str(item['_id']),
                "quantity": item['quantity'],
                "safety_stock": item.get('safety_stock', 0)
            })
        
        if total_available > 0:
            if total_available >= ingredient['quantity']:
                if total_available - ingredient['quantity'] < safety_stock:
                    status = "below_safety"
                else:
                    status = "available"
            else:
                status = "insufficient"
        
        if emergency_item:
            in_emergency = True
        
        availability.append({
            "ingredient": ingredient['name'],
            "required": ingredient['quantity'],
            "unit": ingredient['unit'],
            "available": total_available,
            "safety_stock": safety_stock,
            "status": status,
            "in_emergency_stock": in_emergency,
            "locations": locations  # NEW: array of locations with quantities
        })
    
    return {
        "recipe_id": recipe_id,
        "recipe_name": recipe['name'],
        "ingredients": availability,
        "can_cook": all(ing['status'] in ['available', 'below_safety'] for ing in availability)
    }

@api_router.post("/recipes/{recipe_id}/cook")
async def cook_recipe(recipe_id: str, request: CookRecipeRequest):
    recipe = await db.recipes.find_one({"_id": ObjectId(recipe_id)})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    home_stock = await db.home_stock.find().to_list(1000)
    emergency_stock = await db.emergency_stock.find().to_list(1000)
    
    # Build a map of item_id -> item for quick lookup
    home_stock_by_id = {str(item['_id']): item for item in home_stock}
    
    # Group home stock by name
    home_stock_by_name = {}
    for item in home_stock:
        name_lower = item['name'].lower()
        if name_lower not in home_stock_by_name:
            home_stock_by_name[name_lower] = []
        home_stock_by_name[name_lower].append(item)
    
    emergency_stock_map = {item['name'].lower(): item for item in emergency_stock}
    
    # Build location choices map if provided
    location_choices_map = {}
    if request.location_choices:
        for choice in request.location_choices:
            location_choices_map[choice.ingredient_name.lower()] = choice.item_id
    
    missing_ingredients = []
    deductions = []
    
    for ingredient in recipe['ingredients']:
        ing_name = ingredient['name'].lower()
        required = ingredient['quantity']
        home_items = home_stock_by_name.get(ing_name, [])
        
        # Check if user specified a location choice for this ingredient
        chosen_item_id = location_choices_map.get(ing_name)
        
        if chosen_item_id and chosen_item_id in home_stock_by_id:
            # Use the specifically chosen item
            chosen_item = home_stock_by_id[chosen_item_id]
            if chosen_item['quantity'] >= required:
                deductions.append({
                    "item_id": chosen_item['_id'],
                    "new_quantity": chosen_item['quantity'] - required,
                    "source": "home"
                })
            else:
                missing_ingredients.append({
                    "name": ingredient['name'],
                    "required": required,
                    "available": chosen_item['quantity'],
                    "unit": ingredient['unit']
                })
        elif home_items:
            # Find the first item with enough quantity (default behavior)
            found = False
            for home_item in home_items:
                if home_item['quantity'] >= required:
                    deductions.append({
                        "item_id": home_item['_id'],
                        "new_quantity": home_item['quantity'] - required,
                        "source": "home"
                    })
                    found = True
                    break
            
            if not found:
                # Sum up total available
                total_available = sum(item['quantity'] for item in home_items)
                if request.use_emergency_stock and emergency_stock_map.get(ing_name):
                    emergency_item = emergency_stock_map[ing_name]
                    if emergency_item['quantity'] >= required:
                        deductions.append({
                            "item_id": emergency_item['_id'],
                            "new_quantity": emergency_item['quantity'] - required,
                            "source": "emergency"
                        })
                    else:
                        missing_ingredients.append({
                            "name": ingredient['name'],
                            "required": required,
                            "available": emergency_item['quantity'],
                            "unit": ingredient['unit']
                        })
                else:
                    missing_ingredients.append({
                        "name": ingredient['name'],
                        "required": required,
                        "available": total_available,
                        "unit": ingredient['unit']
                    })
        elif request.use_emergency_stock and emergency_stock_map.get(ing_name):
            emergency_item = emergency_stock_map[ing_name]
            if emergency_item['quantity'] >= required:
                deductions.append({
                    "item_id": emergency_item['_id'],
                    "new_quantity": emergency_item['quantity'] - required,
                    "source": "emergency"
                })
            else:
                missing_ingredients.append({
                    "name": ingredient['name'],
                    "required": required,
                    "available": emergency_item['quantity'],
                    "unit": ingredient['unit']
                })
        else:
            missing_ingredients.append({
                "name": ingredient['name'],
                "required": required,
                "available": 0,
                "unit": ingredient['unit']
            })
    
    if missing_ingredients:
        return {
            "success": False,
            "message": "Missing ingredients",
            "missing_ingredients": missing_ingredients
        }
    
    # Perform deductions
    for deduction in deductions:
        collection = db.home_stock if deduction['source'] == "home" else db.emergency_stock
        await collection.update_one(
            {"_id": deduction['item_id']},
            {"$set": {"quantity": deduction['new_quantity'], "updated_at": datetime.utcnow()}}
        )
    
    return {
        "success": True,
        "message": f"Successfully cooked {recipe['name']}",
        "deductions": [{"source": d['source'], "new_quantity": d['new_quantity']} for d in deductions]
    }

@api_router.get("/recipes/suggestions/what-can-i-cook")
async def what_can_i_cook():
    recipes = await db.recipes.find().to_list(1000)
    home_stock = await db.home_stock.find().to_list(1000)
    
    home_stock_map = {item['name'].lower(): item['quantity'] for item in home_stock}
    
    cookable = []
    partial = []
    
    for recipe in recipes:
        available_count = 0
        total_count = len(recipe['ingredients'])
        
        for ingredient in recipe['ingredients']:
            ing_name = ingredient['name'].lower()
            available = home_stock_map.get(ing_name, 0)
            if available >= ingredient['quantity']:
                available_count += 1
        
        recipe_info = {
            "id": str(recipe['_id']),
            "name": recipe['name'],
            "available_ingredients": available_count,
            "total_ingredients": total_count,
            "percentage": round((available_count / total_count) * 100) if total_count > 0 else 0
        }
        
        if available_count == total_count:
            cookable.append(recipe_info)
        elif available_count > 0:
            partial.append(recipe_info)
    
    return {
        "can_cook": cookable,
        "partial_ingredients": sorted(partial, key=lambda x: x['percentage'], reverse=True)
    }

# ==================== SHOPPING LIST ENDPOINTS ====================

@api_router.get("/shopping-list", response_model=List[ShoppingListItemResponse])
async def get_shopping_list(household_id: Optional[str] = None):
    query = {}
    if household_id:
        query["household_id"] = household_id
    items = await db.shopping_list.find(query).to_list(1000)
    result = []
    for item in items:
        doc = serialize_doc(item)
        # Add default location for items that don't have it
        if 'location' not in doc:
            doc['location'] = 'Uncategorized'
        # Add default store for items that don't have it
        if 'store' not in doc:
            doc['store'] = 'Any Store'
        result.append(ShoppingListItemResponse(**doc))
    return result

@api_router.post("/shopping-list", response_model=ShoppingListItemResponse)
async def create_shopping_list_item(item: ShoppingListItemCreate, household_id: Optional[str] = None):
    now = datetime.utcnow()
    item_dict = item.dict()
    item_dict['checked'] = False
    item_dict['created_at'] = now
    item_dict['updated_at'] = now
    if household_id:
        item_dict['household_id'] = household_id
    result = await db.shopping_list.insert_one(item_dict)
    created = await db.shopping_list.find_one({"_id": result.inserted_id})
    return ShoppingListItemResponse(**serialize_doc(created))

@api_router.put("/shopping-list/{item_id}", response_model=ShoppingListItemResponse)
async def update_shopping_list_item(item_id: str, item: ShoppingListItemUpdate):
    update_data = {k: v for k, v in item.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    update_data['updated_at'] = datetime.utcnow()
    await db.shopping_list.update_one({"_id": ObjectId(item_id)}, {"$set": update_data})
    updated = await db.shopping_list.find_one({"_id": ObjectId(item_id)})
    if not updated:
        raise HTTPException(status_code=404, detail="Item not found")
    return ShoppingListItemResponse(**serialize_doc(updated))

@api_router.delete("/shopping-list/{item_id}")
async def delete_shopping_list_item(item_id: str):
    result = await db.shopping_list.delete_one({"_id": ObjectId(item_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted successfully"}

@api_router.post("/shopping-list/move-to-stock")
async def move_checked_to_stock():
    checked_items = await db.shopping_list.find({"checked": True}).to_list(1000)
    
    if not checked_items:
        return {"message": "No checked items to move", "moved_count": 0}
    
    moved_count = 0
    for item in checked_items:
        item_location = item.get('location', 'Uncategorized')
        
        # Check if item exists in home stock with same name AND location
        existing = await db.home_stock.find_one({
            "name": {"$regex": f"^{item['name']}$", "$options": "i"},
            "location": item_location
        })
        
        if existing:
            # Update existing item quantity
            await db.home_stock.update_one(
                {"_id": existing['_id']},
                {"$inc": {"quantity": item['quantity']}, "$set": {"updated_at": datetime.utcnow()}}
            )
        else:
            # Create new item in the specified location
            new_item = {
                "name": item['name'],
                "quantity": item['quantity'],
                "unit": item['unit'],
                "safety_stock": 0,
                "location": item_location,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            await db.home_stock.insert_one(new_item)
        
        # Delete from shopping list
        await db.shopping_list.delete_one({"_id": item['_id']})
        moved_count += 1
    
    return {"message": f"Moved {moved_count} items to home stock", "moved_count": moved_count}

@api_router.post("/shopping-list/add-missing")
async def add_missing_to_shopping_list(ingredients: List[IngredientWithStore]):
    added = []
    for ing in ingredients:
        # Check if already in shopping list
        existing = await db.shopping_list.find_one({"name": {"$regex": f"^{ing.name}$", "$options": "i"}})
        
        if existing:
            # Update quantity
            await db.shopping_list.update_one(
                {"_id": existing['_id']},
                {"$inc": {"quantity": ing.quantity}, "$set": {"updated_at": datetime.utcnow()}}
            )
        else:
            new_item = {
                "name": ing.name,
                "quantity": ing.quantity,
                "unit": ing.unit,
                "store": ing.store or "Any Store",
                "checked": False,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            await db.shopping_list.insert_one(new_item)
        added.append(ing.name)
    
    return {"message": f"Added {len(added)} items to shopping list", "items": added}

# ==================== STORES MANAGEMENT ENDPOINTS ====================

@api_router.get("/stores")
async def get_stores(household_id: Optional[str] = None):
    """Get all stores for shopping list categorization"""
    query = {}
    if household_id:
        query["household_id"] = household_id
    stores = await db.stores.find(query).to_list(100)
    store_names = [store['name'] for store in stores]
    
    # Always include "Any Store" as default
    if "Any Store" not in store_names:
        store_names.insert(0, "Any Store")
    
    return {"stores": store_names}

@api_router.post("/stores")
async def create_store(name: str, household_id: Optional[str] = None):
    """Create a new store"""
    # Check if store already exists
    query = {"name": name}
    if household_id:
        query["household_id"] = household_id
    
    existing = await db.stores.find_one(query)
    if existing:
        raise HTTPException(status_code=400, detail="Store already exists")
    
    now = datetime.utcnow()
    store_doc = {
        "name": name,
        "created_at": now,
        "updated_at": now
    }
    if household_id:
        store_doc["household_id"] = household_id
    
    await db.stores.insert_one(store_doc)
    return {"message": "Store created", "name": name}

@api_router.put("/stores/{old_name}")
async def rename_store(old_name: str, new_name: str, household_id: Optional[str] = None):
    """Rename a store and update all shopping list items"""
    if old_name == "Any Store":
        raise HTTPException(status_code=400, detail="Cannot rename 'Any Store'")
    
    # Update store name
    query = {"name": old_name}
    if household_id:
        query["household_id"] = household_id
    
    result = await db.stores.update_one(
        query,
        {"$set": {"name": new_name, "updated_at": datetime.utcnow()}}
    )
    
    # Update all shopping list items with this store
    await db.shopping_list.update_many(
        {"store": old_name},
        {"$set": {"store": new_name, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": f"Renamed '{old_name}' to '{new_name}'"}

@api_router.delete("/stores/{name}")
async def delete_store(name: str, household_id: Optional[str] = None):
    """Delete a store and move items to 'Any Store'"""
    if name == "Any Store":
        raise HTTPException(status_code=400, detail="Cannot delete 'Any Store'")
    
    query = {"name": name}
    if household_id:
        query["household_id"] = household_id
    
    # Delete the store
    await db.stores.delete_one(query)
    
    # Move all items with this store to "Any Store"
    await db.shopping_list.update_many(
        {"store": name},
        {"$set": {"store": "Any Store", "updated_at": datetime.utcnow()}}
    )
    
    return {"message": f"Deleted store '{name}' and moved items to 'Any Store'"}

# ==================== DINNER WISHES ENDPOINTS ====================

@api_router.post("/wishes")
async def create_wish(wish: DinnerWishCreate, user_id: str):
    """Create a dinner wish (for child users)"""
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get('role', 'adult') != 'child':
        raise HTTPException(status_code=403, detail="Only child users can make wishes")
    
    if not user.get('household_id'):
        raise HTTPException(status_code=400, detail="User must be part of a household")
    
    # Check pending wishes count
    pending_count = await db.dinner_wishes.count_documents({
        "user_id": user_id,
        "status": "pending"
    })
    
    if pending_count >= MAX_PENDING_WISHES:
        raise HTTPException(
            status_code=400, 
            detail=f"Maximum {MAX_PENDING_WISHES} pending wishes allowed. Wait for an adult to approve some."
        )
    
    # Check if this recipe is already wished
    existing_wish = await db.dinner_wishes.find_one({
        "user_id": user_id,
        "recipe_id": wish.recipe_id,
        "status": "pending"
    })
    
    if existing_wish:
        raise HTTPException(status_code=400, detail="You already wished for this recipe")
    
    now = datetime.utcnow()
    wish_doc = {
        "user_id": user_id,
        "username": user['username'],
        "recipe_id": wish.recipe_id,
        "recipe_name": wish.recipe_name,
        "status": "pending",
        "household_id": user['household_id'],
        "created_at": now
    }
    
    result = await db.dinner_wishes.insert_one(wish_doc)
    
    # Send push notification to all adult household members
    adult_members = await db.users.find({
        "household_id": user['household_id'],
        "role": "adult"
    }).to_list(100)
    
    for adult in adult_members:
        adult_id = str(adult['_id'])
        # Get push tokens for this adult
        tokens = await db.push_tokens.find({"user_id": adult_id}).to_list(10)
        for token_doc in tokens:
            await send_push_notification(
                token_doc['push_token'],
                "🍽️ Dinner Wish!",
                f"{user['username']} wishes to have {wish.recipe_name} for dinner",
                {"type": "dinner_wish", "wish_id": str(result.inserted_id)}
            )
    
    return {
        "id": str(result.inserted_id),
        "message": f"Wish for {wish.recipe_name} created!",
        "pending_count": pending_count + 1
    }

@api_router.get("/wishes")
async def get_wishes(user_id: str, status: Optional[str] = None):
    """Get dinner wishes for a household"""
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.get('household_id'):
        return {"wishes": [], "pending_count": 0}
    
    query = {"household_id": user['household_id']}
    if status:
        query["status"] = status
    
    wishes = await db.dinner_wishes.find(query).sort("created_at", -1).to_list(100)
    
    # Count pending wishes for this user
    user_pending = await db.dinner_wishes.count_documents({
        "user_id": user_id,
        "status": "pending"
    })
    
    return {
        "wishes": [
            {
                "id": str(w['_id']),
                "user_id": w['user_id'],
                "username": w['username'],
                "recipe_id": w['recipe_id'],
                "recipe_name": w['recipe_name'],
                "status": w['status'],
                "created_at": w['created_at']
            }
            for w in wishes
        ],
        "pending_count": user_pending,
        "max_wishes": MAX_PENDING_WISHES
    }

@api_router.put("/wishes/{wish_id}/approve")
async def approve_wish(wish_id: str, user_id: str):
    """Approve a dinner wish (for adult users) - also adds missing ingredients to shopping list"""
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get('role', 'adult') != 'adult':
        raise HTTPException(status_code=403, detail="Only adult users can approve wishes")
    
    wish = await db.dinner_wishes.find_one({"_id": ObjectId(wish_id)})
    if not wish:
        raise HTTPException(status_code=404, detail="Wish not found")
    
    if wish['household_id'] != user.get('household_id'):
        raise HTTPException(status_code=403, detail="Wish belongs to another household")
    
    # Get the recipe to check ingredients
    recipe = await db.recipes.find_one({"_id": ObjectId(wish['recipe_id'])})
    missing_ingredients = []
    
    if recipe and recipe.get('ingredients'):
        # Get all home stock items
        home_stock = await db.home_stock.find().to_list(1000)
        stock_map = {}
        for item in home_stock:
            name_lower = item['name'].lower()
            if name_lower not in stock_map:
                stock_map[name_lower] = 0
            stock_map[name_lower] += item['quantity']
        
        # Check each ingredient
        for ing in recipe['ingredients']:
            ing_name_lower = ing['name'].lower()
            available = stock_map.get(ing_name_lower, 0)
            required = ing['quantity']
            
            if available < required:
                # Need to add to shopping list
                shortage = required - available
                missing_ingredients.append({
                    "name": ing['name'],
                    "quantity": shortage,
                    "unit": ing['unit']
                })
        
        # Add missing ingredients to shopping list
        added_to_list = []
        for missing in missing_ingredients:
            # Check if already in shopping list
            existing = await db.shopping_list.find_one({
                "name": {"$regex": f"^{missing['name']}$", "$options": "i"}
            })
            
            if existing:
                # Update quantity
                await db.shopping_list.update_one(
                    {"_id": existing['_id']},
                    {"$inc": {"quantity": missing['quantity']}, "$set": {"updated_at": datetime.utcnow()}}
                )
            else:
                # Create new item
                new_item = {
                    "name": missing['name'],
                    "quantity": missing['quantity'],
                    "unit": missing['unit'],
                    "store": "Any Store",
                    "checked": False,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                await db.shopping_list.insert_one(new_item)
            added_to_list.append(missing['name'])
    
    # Update wish status
    await db.dinner_wishes.update_one(
        {"_id": ObjectId(wish_id)},
        {"$set": {"status": "approved", "approved_by": user_id, "approved_at": datetime.utcnow()}}
    )
    
    # Notify the child that their wish was approved
    child_tokens = await db.push_tokens.find({"user_id": wish['user_id']}).to_list(10)
    for token_doc in child_tokens:
        await send_push_notification(
            token_doc['push_token'],
            "🎉 Wish Approved!",
            f"Your wish for {wish['recipe_name']} was approved!",
            {"type": "wish_approved", "wish_id": wish_id}
        )
    
    return {
        "message": "Wish approved",
        "recipe_name": wish['recipe_name'],
        "missing_added": len(added_to_list),
        "added_items": added_to_list
    }

@api_router.delete("/wishes/{wish_id}")
async def delete_wish(wish_id: str, user_id: str):
    """Delete a dinner wish"""
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    wish = await db.dinner_wishes.find_one({"_id": ObjectId(wish_id)})
    if not wish:
        raise HTTPException(status_code=404, detail="Wish not found")
    
    # Check permissions: user must be the owner or an adult in the same household
    is_owner = wish['user_id'] == user_id
    is_household_adult = (
        wish['household_id'] == user.get('household_id') and 
        user.get('role', 'adult') == 'adult'
    )
    
    if not is_owner and not is_household_adult:
        raise HTTPException(status_code=403, detail="Not authorized to delete this wish")
    
    await db.dinner_wishes.delete_one({"_id": ObjectId(wish_id)})
    
    return {"message": "Wish deleted"}

# ==================== DASHBOARD ENDPOINT ====================

@api_router.get("/dashboard")
async def get_dashboard(user_id: Optional[str] = None):
    now = datetime.utcnow()
    
    # Get low stock alerts
    home_stock = await db.home_stock.find().to_list(1000)
    low_stock = [
        {
            "id": str(item['_id']),
            "name": item['name'],
            "quantity": item['quantity'],
            "unit": item['unit'],
            "safety_stock": item['safety_stock']
        }
        for item in home_stock
        if item['quantity'] <= item.get('safety_stock', 0) and item.get('safety_stock', 0) > 0
    ]
    
    # Get expiring items (within 7 days)
    from datetime import timedelta
    week_from_now = now + timedelta(days=7)
    emergency_stock = await db.emergency_stock.find({
        "expiration_date": {"$lte": week_from_now}
    }).sort("expiration_date", 1).to_list(100)
    
    expiring_items = [
        {
            "id": str(item['_id']),
            "name": item['name'],
            "expiration_date": item['expiration_date'].isoformat(),
            "days_until_expiry": (item['expiration_date'] - now).days
        }
        for item in emergency_stock
    ]
    
    # Get cookable recipes
    what_can_cook = await what_can_i_cook()
    
    # Get shopping list count
    shopping_count = await db.shopping_list.count_documents({"checked": False})
    
    # Get dinner wishes for the household (only for adults)
    dinner_wishes = []
    if user_id:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if user and user.get('household_id') and user.get('role', 'adult') == 'adult':
            wishes = await db.dinner_wishes.find({
                "household_id": user['household_id'],
                "status": "pending"
            }).sort("created_at", -1).to_list(20)
            
            dinner_wishes = [
                {
                    "id": str(w['_id']),
                    "username": w['username'],
                    "recipe_id": w['recipe_id'],
                    "recipe_name": w['recipe_name'],
                    "created_at": w['created_at'].isoformat()
                }
                for w in wishes
            ]
    
    return {
        "low_stock_alerts": low_stock,
        "expiring_items": expiring_items,
        "recipes_you_can_cook": what_can_cook['can_cook'][:5],
        "shopping_list_count": shopping_count,
        "dinner_wishes": dinner_wishes,
        "timestamp": now.isoformat()
    }

# ==================== HEALTH CHECK ====================

@api_router.get("/")
async def root():
    return {"message": "Kitchen Counter API is running", "status": "healthy"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
