#!/usr/bin/env python3
"""
Comprehensive Backend API Tests for Kitchen Counter App
Tests all CRUD operations and business logic endpoints
"""

import requests
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any
import sys
import traceback

# Use localhost as specified in the testing request
BASE_URL = "http://localhost:8001/api"

class APITestSuite:
    def __init__(self):
        self.session = requests.Session()
        self.test_data = {}
        self.failed_tests = []
        self.passed_tests = []
        self.critical_failures = []
        
    def log(self, message: str, test_type: str = "INFO"):
        print(f"[{test_type}] {message}")
        
    def assert_response(self, response: requests.Response, expected_status: int, test_name: str):
        """Assert response status and log results"""
        try:
            if response.status_code != expected_status:
                error_msg = f"{test_name} - Expected {expected_status}, got {response.status_code}"
                if response.content:
                    try:
                        error_detail = response.json()
                        error_msg += f" - {error_detail}"
                    except:
                        error_msg += f" - {response.text}"
                self.log(error_msg, "FAIL")
                self.failed_tests.append(error_msg)
                return False
            else:
                self.log(f"{test_name} - SUCCESS", "PASS")
                self.passed_tests.append(test_name)
                return True
        except Exception as e:
            error_msg = f"{test_name} - Exception: {str(e)}"
            self.log(error_msg, "CRITICAL")
            self.critical_failures.append(error_msg)
            return False

    def test_health_endpoint(self):
        """Test basic health check"""
        self.log("Testing health endpoint...")
        try:
            response = self.session.get(f"{BASE_URL}/")
            if self.assert_response(response, 200, "Health Check"):
                data = response.json()
                self.log(f"Health response: {data}")
                return True
        except Exception as e:
            self.log(f"Health check failed: {str(e)}", "CRITICAL")
            self.critical_failures.append(f"Health check failed: {str(e)}")
            return False

    # ==================== HOME STOCK TESTS ====================
    
    def test_home_stock_crud(self):
        """Test complete Home Stock CRUD operations"""
        self.log("Testing Home Stock CRUD operations...")
        
        # Test GET all home stock
        response = self.session.get(f"{BASE_URL}/home-stock")
        if not self.assert_response(response, 200, "GET Home Stock List"):
            return False
        
        initial_items = response.json()
        self.log(f"Initial home stock items: {len(initial_items)}")
        
        # Test POST create new item
        new_item = {
            "name": "Test Flour",
            "quantity": 2500.0,
            "unit": "grams",
            "safety_stock": 500.0
        }
        
        response = self.session.post(f"{BASE_URL}/home-stock", json=new_item)
        if not self.assert_response(response, 200, "POST Create Home Stock Item"):
            return False
            
        created_item = response.json()
        item_id = created_item['id']
        self.test_data['home_stock_id'] = item_id
        self.log(f"Created home stock item with ID: {item_id}")
        
        # Test GET single item
        response = self.session.get(f"{BASE_URL}/home-stock/{item_id}")
        if not self.assert_response(response, 200, "GET Single Home Stock Item"):
            return False
            
        # Test PUT update item
        update_data = {
            "quantity": 3000.0,
            "safety_stock": 600.0
        }
        
        response = self.session.put(f"{BASE_URL}/home-stock/{item_id}", json=update_data)
        if not self.assert_response(response, 200, "PUT Update Home Stock Item"):
            return False
            
        updated_item = response.json()
        if updated_item['quantity'] != 3000.0:
            self.failed_tests.append("Home Stock Update - quantity not updated correctly")
            return False
        
        # Test quick-add functionality
        quick_add_data = {
            "item_id": item_id,
            "quantity_change": 500.0
        }
        
        response = self.session.post(f"{BASE_URL}/home-stock/quick-add", json=quick_add_data)
        if not self.assert_response(response, 200, "POST Home Stock Quick Add"):
            return False
            
        quick_added_item = response.json()
        if quick_added_item['quantity'] != 3500.0:
            self.failed_tests.append("Home Stock Quick Add - quantity not updated correctly")
            return False
        
        # Test negative quick-add
        quick_subtract_data = {
            "item_id": item_id,
            "quantity_change": -1000.0
        }
        
        response = self.session.post(f"{BASE_URL}/home-stock/quick-add", json=quick_subtract_data)
        if not self.assert_response(response, 200, "POST Home Stock Quick Subtract"):
            return False
            
        # Test DELETE item
        response = self.session.delete(f"{BASE_URL}/home-stock/{item_id}")
        if not self.assert_response(response, 200, "DELETE Home Stock Item"):
            return False
        
        # Verify deletion
        response = self.session.get(f"{BASE_URL}/home-stock/{item_id}")
        if not self.assert_response(response, 404, "GET Deleted Home Stock Item (should be 404)"):
            return False
            
        return True

    # ==================== EMERGENCY STOCK TESTS ====================
    
    def test_emergency_stock_crud(self):
        """Test complete Emergency Stock CRUD operations"""
        self.log("Testing Emergency Stock CRUD operations...")
        
        # Test GET all emergency stock
        response = self.session.get(f"{BASE_URL}/emergency-stock")
        if not self.assert_response(response, 200, "GET Emergency Stock List"):
            return False
        
        # Test POST create new item
        future_date = (datetime.now() + timedelta(days=30)).isoformat()
        new_item = {
            "name": "Test Emergency Water",
            "quantity": 5.0,
            "unit": "liters",
            "expiration_date": future_date
        }
        
        response = self.session.post(f"{BASE_URL}/emergency-stock", json=new_item)
        if not self.assert_response(response, 200, "POST Create Emergency Stock Item"):
            return False
            
        created_item = response.json()
        item_id = created_item['id']
        self.test_data['emergency_stock_id'] = item_id
        
        # Test PUT update item
        update_data = {
            "quantity": 6.0
        }
        
        response = self.session.put(f"{BASE_URL}/emergency-stock/{item_id}", json=update_data)
        if not self.assert_response(response, 200, "PUT Update Emergency Stock Item"):
            return False
        
        # Test DELETE item
        response = self.session.delete(f"{BASE_URL}/emergency-stock/{item_id}")
        if not self.assert_response(response, 200, "DELETE Emergency Stock Item"):
            return False
            
        return True

    # ==================== RECIPE TESTS ====================
    
    def test_recipes_crud(self):
        """Test complete Recipes CRUD operations"""
        self.log("Testing Recipes CRUD operations...")
        
        # Test GET all recipes
        response = self.session.get(f"{BASE_URL}/recipes")
        if not self.assert_response(response, 200, "GET Recipes List"):
            return False
        
        # Test POST create new recipe
        new_recipe = {
            "name": "Test Pasta Recipe",
            "ingredients": [
                {"name": "Pasta", "quantity": 200.0, "unit": "grams"},
                {"name": "Tomato Sauce", "quantity": 300.0, "unit": "ml"}
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/recipes", json=new_recipe)
        if not self.assert_response(response, 200, "POST Create Recipe"):
            return False
            
        created_recipe = response.json()
        recipe_id = created_recipe['id']
        self.test_data['recipe_id'] = recipe_id
        
        # Test GET single recipe
        response = self.session.get(f"{BASE_URL}/recipes/{recipe_id}")
        if not self.assert_response(response, 200, "GET Single Recipe"):
            return False
        
        # Test PUT update recipe
        update_data = {
            "name": "Updated Test Pasta Recipe"
        }
        
        response = self.session.put(f"{BASE_URL}/recipes/{recipe_id}", json=update_data)
        if not self.assert_response(response, 200, "PUT Update Recipe"):
            return False
        
        # Test recipe availability check
        response = self.session.get(f"{BASE_URL}/recipes/{recipe_id}/availability")
        if not self.assert_response(response, 200, "GET Recipe Availability"):
            return False
            
        availability_data = response.json()
        self.log(f"Recipe availability: {availability_data}")
        
        # Test DELETE recipe
        response = self.session.delete(f"{BASE_URL}/recipes/{recipe_id}")
        if not self.assert_response(response, 200, "DELETE Recipe"):
            return False
            
        return True

    def test_recipe_cooking(self):
        """Test recipe cooking functionality with actual stock deduction"""
        self.log("Testing Recipe Cooking functionality...")
        
        # First create some home stock items for cooking
        milk_item = {
            "name": "Test Milk",
            "quantity": 1000.0,
            "unit": "ml",
            "safety_stock": 200.0
        }
        
        response = self.session.post(f"{BASE_URL}/home-stock", json=milk_item)
        if not self.assert_response(response, 200, "Create Milk for Cooking Test"):
            return False
        milk_id = response.json()['id']
        
        flour_item = {
            "name": "Test Cooking Flour",
            "quantity": 2000.0,
            "unit": "grams",
            "safety_stock": 100.0
        }
        
        response = self.session.post(f"{BASE_URL}/home-stock", json=flour_item)
        if not self.assert_response(response, 200, "Create Flour for Cooking Test"):
            return False
        flour_id = response.json()['id']
        
        # Create a recipe that uses these ingredients
        recipe_data = {
            "name": "Test Pancakes",
            "ingredients": [
                {"name": "Test Milk", "quantity": 250.0, "unit": "ml"},
                {"name": "Test Cooking Flour", "quantity": 300.0, "unit": "grams"}
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/recipes", json=recipe_data)
        if not self.assert_response(response, 200, "Create Cooking Test Recipe"):
            return False
        recipe_id = response.json()['id']
        
        # Check availability before cooking
        response = self.session.get(f"{BASE_URL}/recipes/{recipe_id}/availability")
        if not self.assert_response(response, 200, "Check Recipe Availability Before Cooking"):
            return False
        
        # Cook the recipe
        cook_data = {
            "recipe_id": recipe_id,
            "use_emergency_stock": False
        }
        
        response = self.session.post(f"{BASE_URL}/recipes/{recipe_id}/cook", json=cook_data)
        if not self.assert_response(response, 200, "POST Cook Recipe"):
            return False
            
        cook_result = response.json()
        if not cook_result.get('success'):
            self.failed_tests.append(f"Recipe cooking failed: {cook_result}")
            return False
        
        # Verify stock was deducted
        response = self.session.get(f"{BASE_URL}/home-stock/{milk_id}")
        if self.assert_response(response, 200, "Check Milk After Cooking"):
            updated_milk = response.json()
            if updated_milk['quantity'] != 750.0:  # 1000 - 250
                self.failed_tests.append(f"Milk quantity not deducted correctly: expected 750, got {updated_milk['quantity']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/recipes/{recipe_id}")
        self.session.delete(f"{BASE_URL}/home-stock/{milk_id}")
        self.session.delete(f"{BASE_URL}/home-stock/{flour_id}")
        
        return True

    # ==================== WHAT CAN I COOK TESTS ====================
    
    def test_what_can_i_cook(self):
        """Test what can I cook suggestions"""
        self.log("Testing What Can I Cook endpoint...")
        
        response = self.session.get(f"{BASE_URL}/recipes/suggestions/what-can-i-cook")
        if not self.assert_response(response, 200, "GET What Can I Cook"):
            return False
            
        suggestions = response.json()
        self.log(f"What can I cook suggestions: {suggestions}")
        
        # Verify structure
        if 'can_cook' not in suggestions or 'partial_ingredients' not in suggestions:
            self.failed_tests.append("What can I cook response missing required fields")
            return False
            
        return True

    # ==================== SHOPPING LIST TESTS ====================
    
    def test_shopping_list_crud(self):
        """Test complete Shopping List CRUD operations"""
        self.log("Testing Shopping List CRUD operations...")
        
        # Test GET all shopping list
        response = self.session.get(f"{BASE_URL}/shopping-list")
        if not self.assert_response(response, 200, "GET Shopping List"):
            return False
        
        # Test POST create new item
        new_item = {
            "name": "Test Bread",
            "quantity": 2.0,
            "unit": "loaves"
        }
        
        response = self.session.post(f"{BASE_URL}/shopping-list", json=new_item)
        if not self.assert_response(response, 200, "POST Create Shopping List Item"):
            return False
            
        created_item = response.json()
        item_id = created_item['id']
        self.test_data['shopping_list_id'] = item_id
        
        # Test PUT update item (check it)
        update_data = {
            "checked": True
        }
        
        response = self.session.put(f"{BASE_URL}/shopping-list/{item_id}", json=update_data)
        if not self.assert_response(response, 200, "PUT Update Shopping List Item"):
            return False
        
        # Test move checked items to stock
        response = self.session.post(f"{BASE_URL}/shopping-list/move-to-stock")
        if not self.assert_response(response, 200, "POST Move Checked to Stock"):
            return False
            
        move_result = response.json()
        self.log(f"Move to stock result: {move_result}")
        
        # Verify item was moved (should be deleted from shopping list)
        response = self.session.get(f"{BASE_URL}/shopping-list/{item_id}")
        if not self.assert_response(response, 404, "GET Moved Shopping Item (should be 404)"):
            return False
        
        # Test add missing ingredients to shopping list
        missing_ingredients = [
            {"name": "Test Sugar", "quantity": 500.0, "unit": "grams"},
            {"name": "Test Salt", "quantity": 100.0, "unit": "grams"}
        ]
        
        response = self.session.post(f"{BASE_URL}/shopping-list/add-missing", json=missing_ingredients)
        if not self.assert_response(response, 200, "POST Add Missing to Shopping List"):
            return False
            
        return True

    # ==================== DASHBOARD TESTS ====================
    
    def test_dashboard(self):
        """Test dashboard aggregation endpoint"""
        self.log("Testing Dashboard endpoint...")
        
        response = self.session.get(f"{BASE_URL}/dashboard")
        if not self.assert_response(response, 200, "GET Dashboard"):
            return False
            
        dashboard_data = response.json()
        self.log(f"Dashboard data keys: {list(dashboard_data.keys())}")
        
        # Verify required fields
        required_fields = ['low_stock_alerts', 'expiring_items', 'recipes_you_can_cook', 'shopping_list_count']
        for field in required_fields:
            if field not in dashboard_data:
                self.failed_tests.append(f"Dashboard missing required field: {field}")
                return False
        
        return True

    # ==================== ERROR HANDLING TESTS ====================
    
    def test_error_handling(self):
        """Test error handling for invalid requests"""
        self.log("Testing Error Handling...")
        
        # Test invalid item ID
        response = self.session.get(f"{BASE_URL}/home-stock/invalid-id")
        # This might return 422 or 400 for invalid ObjectId format, not 404
        if response.status_code not in [400, 422, 500]:
            self.failed_tests.append(f"Invalid ID should return 400/422/500, got {response.status_code}")
        
        # Test missing required fields
        response = self.session.post(f"{BASE_URL}/home-stock", json={})
        if not self.assert_response(response, 422, "POST Home Stock Missing Fields"):
            return False
        
        # Test non-existent recipe cooking
        fake_recipe_id = "507f1f77bcf86cd799439011"  # Valid ObjectId format
        cook_data = {"recipe_id": fake_recipe_id, "use_emergency_stock": False}
        response = self.session.post(f"{BASE_URL}/recipes/{fake_recipe_id}/cook", json=cook_data)
        if not self.assert_response(response, 404, "POST Cook Non-existent Recipe"):
            return False
            
        return True

    def run_all_tests(self):
        """Run all test suites"""
        self.log("=" * 60)
        self.log("STARTING KITCHEN COUNTER BACKEND API TESTS")
        self.log("=" * 60)
        
        test_methods = [
            self.test_health_endpoint,
            self.test_home_stock_crud,
            self.test_emergency_stock_crud,
            self.test_recipes_crud,
            self.test_recipe_cooking,
            self.test_what_can_i_cook,
            self.test_shopping_list_crud,
            self.test_dashboard,
            self.test_error_handling
        ]
        
        total_tests = len(test_methods)
        passed_suites = 0
        
        for test_method in test_methods:
            try:
                self.log(f"\n--- Running {test_method.__name__} ---")
                if test_method():
                    passed_suites += 1
                    self.log(f"{test_method.__name__} completed successfully")
                else:
                    self.log(f"{test_method.__name__} failed", "FAIL")
            except Exception as e:
                self.log(f"{test_method.__name__} crashed: {str(e)}", "CRITICAL")
                self.critical_failures.append(f"{test_method.__name__}: {str(e)}")
                traceback.print_exc()
        
        # Final results
        self.log("\n" + "=" * 60)
        self.log("FINAL TEST RESULTS")
        self.log("=" * 60)
        self.log(f"Test Suites: {passed_suites}/{total_tests} passed")
        self.log(f"Individual Tests: {len(self.passed_tests)} passed, {len(self.failed_tests)} failed")
        self.log(f"Critical Failures: {len(self.critical_failures)}")
        
        if self.failed_tests:
            self.log("\nFAILED TESTS:")
            for failure in self.failed_tests:
                self.log(f"  ❌ {failure}")
        
        if self.critical_failures:
            self.log("\nCRITICAL FAILURES:")
            for failure in self.critical_failures:
                self.log(f"  🚨 {failure}")
        
        if self.passed_tests:
            self.log(f"\nPASSED TESTS: {len(self.passed_tests)} successful operations")
        
        # Return overall success
        return len(self.critical_failures) == 0 and passed_suites == total_tests

if __name__ == "__main__":
    tester = APITestSuite()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 ALL TESTS PASSED! Kitchen Counter API is working correctly.")
        sys.exit(0)
    else:
        print(f"\n❌ TESTS FAILED! {len(tester.failed_tests)} failures, {len(tester.critical_failures)} critical issues")
        sys.exit(1)