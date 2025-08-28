import { RealtimeAgent, tool } from '@openai/agents/realtime';

// Pre-loaded menu for the Indian restaurant
const RESTAURANT_MENU = {
  starters: [
    { name: "Samosa", price: 30, description: "Crispy fried pastry with spiced potato filling" },
    { name: "Pakora", price: 40, description: "Mixed vegetable fritters" },
    { name: "Chaat", price: 50, description: "Tangy street food snack" },
    { name: "Spring Roll", price: 45, description: "Crispy vegetables wrapped in thin pastry" }
  ],
  mainCourse: [
    { name: "Masala Dosa", price: 80, description: "Crispy rice crepe with spiced potato filling" },
    { name: "Plain Dosa", price: 60, description: "Crispy rice crepe" },
    { name: "Idli", price: 40, description: "Steamed rice cakes served with sambar and chutney" },
    { name: "Vada", price: 35, description: "Deep fried lentil donuts" },
    { name: "Uttapam", price: 70, description: "Thick pancake with vegetables" },
    { name: "Biryani", price: 120, description: "Fragrant rice dish with spices and vegetables" },
    { name: "Dal Rice", price: 90, description: "Lentil curry with steamed rice" },
    { name: "Curd Rice", price: 60, description: "Rice mixed with yogurt and tempered spices" },
    { name: "Chapati", price: 20, description: "Indian flatbread" },
    { name: "Naan", price: 30, description: "Leavened flatbread" },
    { name: "Paneer Butter Masala", price: 140, description: "Cottage cheese in rich tomato gravy" }
  ],
  beverages: [
    { name: "Filter Coffee", price: 25, description: "Traditional South Indian coffee" },
    { name: "Tea", price: 20, description: "Indian spiced tea" },
    { name: "Lassi", price: 40, description: "Yogurt-based drink" },
    { name: "Fresh Lime", price: 30, description: "Fresh lime juice with soda" },
    { name: "Buttermilk", price: 25, description: "Spiced yogurt drink" },
    { name: "Tender Coconut", price: 35, description: "Fresh coconut water" }
  ],
  desserts: [
    { name: "Gulab Jamun", price: 40, description: "Sweet fried dumplings in sugar syrup" },
    { name: "Rasmalai", price: 50, description: "Cottage cheese dumplings in sweetened milk" },
    { name: "Ice Cream", price: 45, description: "Vanilla, chocolate, or strawberry" },
    { name: "Kulfi", price: 35, description: "Traditional Indian ice cream" }
  ]
};

export const restaurantOrderAgent = new RealtimeAgent({
  name: 'restaurant_order_agent',
  voice: 'alloy',
  handoffDescription: 'An Indian restaurant voice assistant that takes food orders from customers sitting at tables.',

  instructions: `
# Personality and Identity
You are a polite and friendly voice assistant with girl voice for "UrbanHarvest Zaika", an Indian restaurant. You are taking food orders in real-time conversation with customers sitting at the table.

# Your Capabilities
- Greet customers warmly using "Namaste" and respectful terms like "sir", "ma'am", "please"
- Understand natural language and Hinglish (mix of Hindi and English)
- Refer to the pre-loaded menu and help customers choose items
- Confirm each item and ask for quantity
- Ask for special instructions like "no onion", "less spicy", "no chutney", etc.
- Get customer's name once order is complete
- Summarize the complete order before finalizing
- Submit the order via API call

# Important Rules
- Table number comes from the system - NEVER ask the customer for table number
- Be respectful and use proper Indian hospitality language
- If customer says "that's all", "bas", "enough", consider order complete
- If customer is silent or unsure, suggest popular dishes from the menu
- If customer asks for items not on menu, politely suggest available alternatives
- DO NOT handle payments - only take the order
- Always confirm quantities and special instructions
- if user is speaking any language then reply in that language only. 

# Menu Knowledge
You have access to a complete menu with:
- STARTERS: Samosa, Pakora, Chaat, Spring Roll
- MAIN COURSE: Various dosas, idli, vada, biryani, dal rice, paneer dishes, breads
- BEVERAGES: Filter coffee, tea, lassi, fresh lime, buttermilk, tender coconut
- DESSERTS: Gulab jamun, rasmalai, ice cream, kulfi

# Conversation Flow
1. Greet warmly with "Namaste! Welcome to UrbanHarvest Zaika"
2. Ask what they would like to order
3. For each item mentioned:
   - Confirm the item name
   - Ask for quantity
   - Ask for any special instructions
4. Continue until customer says "that's all" or "bas"
5. Ask for customer's name
6. Summarize the complete order
7. Submit order using the place_order tool
8. Confirm order placement and thank the customer

# Language Style
- Use respectful Hindi/English mix naturally
- Common phrases: "ji haan", "acha", "theek hai", "kya chahiye"
- Be warm and hospitality-focused like real Indian restaurant staff
- Speak clearly and confirm details to avoid mistakes

#Language Examples
 - use malayalam when customer speaks in malayalam
 - use indian tamil when customer speaks in indian tamil
 - use hindi when customer speaks in hindi
 - use english when customer speaks in english
 - use hinglish when customer speaks in hinglish
 - use urdu when customer speaks in urdu
 - use kannada when customer speaks in kannada
 - use telugu when customer speaks in telugu
 - use bengali when customer speaks in bengali
 - use punjabi when customer speaks in punjabi
 - use gujarati when customer speaks in gujarati
 - use marathi when customer speaks in marathi

# Special Instructions Handling
- Listen for dietary preferences: "no onion", "less spicy", "extra spicy", "no chutney"
- Confirm these instructions clearly
- Ask if they want anything else after each item

Remember: You are representing Indian hospitality - be warm, respectful, and helpful!
`,

  tools: [
    tool({
      name: "get_menu_items",
      description: "Get menu items from a specific category or search for items",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["starters", "mainCourse", "beverages", "desserts", "all"],
            description: "The menu category to retrieve items from"
          },
          search_term: {
            type: "string",
            description: "Optional search term to find specific items"
          }
        },
        required: ["category"],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { category, search_term } = input;
        if (category === "all") {
          return {
            menu: RESTAURANT_MENU,
            message: "Complete menu retrieved"
          };
        }
        
        const items = RESTAURANT_MENU[category as keyof typeof RESTAURANT_MENU] || [];
        
        if (search_term) {
          const filtered = items.filter(item => 
            item.name.toLowerCase().includes(search_term.toLowerCase()) ||
            item.description.toLowerCase().includes(search_term.toLowerCase())
          );
          return {
            items: filtered,
            category,
            search_term,
            message: `Found ${filtered.length} items matching "${search_term}" in ${category}`
          };
        }
        
        return {
          items,
          category,
          message: `Retrieved ${items.length} items from ${category}`
        };
      },
    }),

    tool({
      name: "place_order",
      description: "Submit the complete order to the restaurant system",
      parameters: {
        type: "object",
        properties: {
          customer_name: {
            type: "string",
            description: "The customer's name"
          },
          table_number: {
            type: "string",
            description: "Table number - should be set to 'T4' by default"
          },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Name of the food item"
                },
                quantity: {
                  type: "number",
                  description: "Quantity of the item"
                }
              },
              required: ["name", "quantity"]
            },
            description: "Array of ordered items with quantities"
          },
          total_items: {
            type: "number",
            description: "Total number of items (sum of all quantities)"
          },
          special_instructions: {
            type: "string",
            description: "Any special instructions like 'no onion', 'less spicy', etc."
          }
        },
        required: ["customer_name", "table_number", "items", "total_items"],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { customer_name, table_number, items, total_items, special_instructions } = input;
        
        const orderData = {
          customer_name,
          table_number: table_number || "T4", // Default table number
          items,
          total_items,
          special_instructions: special_instructions || ""
        };

        // Always log the order details to console
        console.log("🍽️ Restaurant Order Details:");
        console.log("============================");
        console.log("Customer Name:", orderData.customer_name);
        console.log("Table Number:", orderData.table_number);
        console.log("Items Ordered:");
        orderData.items.forEach((item: any, index: number) => {
          console.log(`  ${index + 1}. ${item.name} × ${item.quantity}`);
        });
        console.log("Total Items:", orderData.total_items);
        if (orderData.special_instructions) {
          console.log("Special Instructions:", orderData.special_instructions);
        }
        console.log("Order Timestamp:", new Date().toISOString());
        console.log("============================");

        try {
          // Log the API request details
          console.log("📡 Attempting to send order to API:");
          console.log("URL: http://localhost:2222/orderdetails");
          console.log("Method: POST");
          console.log("Request Body:", JSON.stringify(orderData, null, 2));

          // Make API call to submit order
          const response = await fetch('http://localhost:2222/orderdetails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderData)
          });

          if (response.ok) {
            const responseData = await response.json().catch(() => ({}));
            console.log("✅ Order API Response Success:", responseData);
            
            return {
              success: true,
              message: "Order placed successfully!",
              order_id: `ORD-${Date.now()}`,
              orderData
            };
          } else {
            console.log("❌ Order API Response Failed:", {
              status: response.status,
              statusText: response.statusText,
              url: response.url
            });
            
            // Fallback: Order logged to console even if API fails
            console.log("📝 Order has been logged to console for manual processing");
            
            return {
              success: true, // Still return success since order is logged
              message: "Order received and logged. Kitchen will be notified manually.",
              order_id: `ORD-${Date.now()}`,
              orderData,
              fallback: true,
              api_error: response.statusText
            };
          }
        } catch (error: any) {
          console.log("🚨 Network Error occurred:");
          console.log("Error Type:", error?.name || "Unknown");
          console.log("Error Message:", error?.message || "Unknown error");
          console.log("Error Stack:", error?.stack || "No stack trace");
          
          // Fallback: Order still logged to console
          console.log("📝 Order has been logged to console despite network error");
          console.log("🔄 Manual order processing required");
          
          return {
            success: true, // Return success since order is logged
            message: "Order received and logged. Network unavailable - kitchen will be notified manually.",
            order_id: `ORD-${Date.now()}`,
            orderData,
            fallback: true,
            network_error: error?.message || "Network connectivity issue"
          };
        }
      },
    }),

    tool({
      name: "suggest_popular_items",
      description: "Get suggestions for popular menu items when customer is unsure",
      parameters: {
        type: "object",
        properties: {
          meal_type: {
            type: "string",
            enum: ["breakfast", "lunch", "dinner", "snacks", "beverages"],
            description: "Type of meal to suggest items for"
          }
        },
        required: [],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { meal_type } = input;
        const suggestions = {
          breakfast: ["Masala Dosa", "Idli", "Filter Coffee"],
          lunch: ["Biryani", "Dal Rice", "Paneer Butter Masala", "Naan"],
          dinner: ["Biryani", "Paneer Butter Masala", "Chapati", "Lassi"],
          snacks: ["Samosa", "Pakora", "Chaat", "Tea"],
          beverages: ["Filter Coffee", "Lassi", "Fresh Lime", "Buttermilk"]
        };

        const items = suggestions[meal_type as keyof typeof suggestions] || suggestions.lunch;
        
        return {
          suggested_items: items,
          meal_type,
          message: `Popular ${meal_type} items suggested`
        };
      },
    })
  ],

  handoffs: [], // No handoffs needed for restaurant order agent
});
