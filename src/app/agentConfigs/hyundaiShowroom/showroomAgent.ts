import { RealtimeAgent, tool } from '@openai/agents/realtime';

// Hyundai car data with detailed specifications
const CARS_DATA = {
  Exter: [
    { variant: "1.2 Kappa Petrol MT", mileage: "19.4 kmpl", fuelType: "Petrol", carType: "SUV", power: "81.8 bhp at 113.8 Nm" },
    { variant: "1.2 Kappa Petrol AMT", mileage: "19.2 kmpl", fuelType: "Petrol", carType: "SUV", power: "81.8 bhp at 113.8 Nm" },
    { variant: "1.2 Bi-fuel CNG MT", mileage: "27.1 km/kg", fuelType: "CNG", carType: "SUV", power: "69 PS at 95.2 Nm" }
  ],
  "Grand i10 Nios": [
    { variant: "1.2 Petrol MT", mileage: "18 kmpl", fuelType: "Petrol", carType: "Hatchback", power: "82 bhp at 113.8 Nm" },
    { variant: "1.2 Petrol AMT", mileage: "16 kmpl", fuelType: "Petrol", carType: "Hatchback", power: "82 bhp at 113.8 Nm" },
    { variant: "1.2 CNG MT", mileage: "27 km/kg", fuelType: "CNG", carType: "Hatchback", power: "68 bhp at 95.2 Nm" }
  ],
  i20: [
    { variant: "1.2 Petrol MT", mileage: "19.6 kmpl", fuelType: "Petrol", carType: "Hatchback", power: "83 PS at 114.7 Nm" },
    { variant: "1.2 Petrol iVT", mileage: "18.0 kmpl", fuelType: "Petrol", carType: "Hatchback", power: "88 PS at 114.7 Nm" }
  ],
  "i20 N Line": [
    { variant: "1.0 Turbo Petrol 6MT", mileage: "20.0 kmpl", fuelType: "Petrol", carType: "Hatchback", power: "120 PS at 172 Nm" },
    { variant: "1.0 Turbo Petrol 7DCT", mileage: "20.0 kmpl", fuelType: "Petrol", carType: "Hatchback", power: "120 PS at 172 Nm" }
  ],
  Aura: [
    { variant: "1.2 Petrol MT", mileage: "20.5 kmpl", fuelType: "Petrol", carType: "Sedan", power: "83 PS at 114 Nm" },
    { variant: "1.2 Petrol AMT", mileage: "20.1 kmpl", fuelType: "Petrol", carType: "Sedan", power: "83 PS at 114 Nm" },
    { variant: "1.2 CNG MT", mileage: "22.0 km/kg", fuelType: "CNG", carType: "Sedan", power: "68 bhp at 95.2 Nm" }
  ],
  Venue: [
    { variant: "1.2 Petrol MT", mileage: "17.27 kmpl", fuelType: "Petrol", carType: "SUV", power: "83 PS at 114 Nm" },
    { variant: "1.0 Turbo Petrol 7DCT", mileage: "18.31 kmpl", fuelType: "Petrol", carType: "SUV", power: "120 PS at 172 Nm" },
    { variant: "1.5 Diesel MT", mileage: "24.2 kmpl", fuelType: "Diesel", carType: "SUV", power: "100 PS at 240 Nm" }
  ],
  "Venue N Line": [
    { variant: "1.0 Turbo Petrol 6MT", mileage: "18.0 kmpl", fuelType: "Petrol", carType: "SUV", power: "118.4 bhp at 172 Nm" },
    { variant: "1.0 Turbo Petrol 7DCT", mileage: "18.0 kmpl", fuelType: "Petrol", carType: "SUV", power: "118.4 bhp at 172 Nm" }
  ],
  Creta: [
    { variant: "1.5 Petrol MT", mileage: "17.4 kmpl", fuelType: "Petrol", carType: "SUV", power: "115 PS at 144 Nm" },
    { variant: "1.5 Petrol IVT", mileage: "18.4 kmpl", fuelType: "Petrol", carType: "SUV", power: "115 PS at 144 Nm" },
    { variant: "1.5 Turbo Petrol 7DCT", mileage: "18.0 kmpl", fuelType: "Petrol", carType: "SUV", power: "160 PS at 253 Nm" },
    { variant: "1.5 Diesel MT", mileage: "21.8 kmpl", fuelType: "Diesel", carType: "SUV", power: "116 PS at 250 Nm" },
    { variant: "1.5 Diesel AT", mileage: "20.4 kmpl", fuelType: "Diesel", carType: "SUV", power: "116 PS at 250 Nm" }
  ],
  "Creta N Line": [
    { variant: "1.5 Turbo Petrol 6MT", mileage: "18.0 kmpl", fuelType: "Petrol", carType: "SUV", power: "160 PS at 253 Nm" },
    { variant: "1.5 Turbo Petrol 7DCT", mileage: "18.2 kmpl", fuelType: "Petrol", carType: "SUV", power: "160 PS at 253 Nm" }
  ],
  Alcazar: [
    { variant: "1.5 Turbo Petrol 7DCT", mileage: "~18–19 kmpl", fuelType: "Petrol", carType: "SUV", power: "160 PS at 253 Nm" },
    { variant: "1.5 Diesel MT", mileage: "20.4 kmpl", fuelType: "Diesel", carType: "SUV", power: "116 PS at 250 Nm" },
    { variant: "1.5 Diesel AT", mileage: "~18–19 kmpl", fuelType: "Diesel", carType: "SUV", power: "116 PS at 250 Nm" }
  ],
  Tucson: [
    { variant: "2.0 Petrol 6AT", mileage: "13 kmpl", fuelType: "Petrol", carType: "SUV", power: "156 PS at 192 Nm" },
    { variant: "2.0 Diesel 8AT", mileage: "18 kmpl", fuelType: "Diesel", carType: "SUV", power: "183.7 bhp at 416 Nm" }
  ],
  Verna: [
    { variant: "1.5 Petrol 6MT", mileage: "18.6 kmpl", fuelType: "Petrol", carType: "Sedan", power: "115 PS at 144 Nm" },
    { variant: "1.5 Turbo Petrol 7DCT", mileage: "20.6 kmpl", fuelType: "Petrol", carType: "Sedan", power: "160 PS at 253 Nm" }
  ],
  "IONIQ 5": [
    { variant: "72.6 kWh RWD (Single motor)", mileage: "ARAI range 631 km", fuelType: "Electric", carType: "SUV", power: "160 kW at 350 Nm" }
  ]
};

export const hyundaiShowroomAgent = new RealtimeAgent({
  name: 'hyundai_showroom_agent',
  voice: 'alloy',
  handoffDescription: 'A professional Hyundai car showroom assistant helping customers explore vehicle options.',

  instructions: `
# Personality and Identity
You are PAVS, a professional and knowledgeable sales assistant at Hyundai Capital Showroom. You are friendly, informative, and focused on helping customers find the perfect Hyundai vehicle for their needs.

# Your Capabilities
- Greet customers warmly and professionally
- Provide detailed information about all Hyundai models and variants
- Help customers compare different vehicles based on their requirements
- Offer insights on mileage, power, fuel types, and car categories
- Schedule test drives and appointments
- Provide information about financing options
- Answer technical questions about vehicle specifications

# Important Guidelines
- Always greet new customers with: "Hello and welcome to Hyundai Capital Showroom! My name is PAVS, and I'll be happy to assist you today."
- Ask if it's their first visit to build rapport
- Listen carefully to customer needs and preferences
- Provide accurate information from the car database
- Always suggest test drives when appropriate
- Be helpful, patient, and professional at all times
- Focus on matching customers with the right vehicle for their lifestyle

# Hyundai Lineup Knowledge
You have access to complete specifications for:
- HATCHBACKS: Grand i10 Nios, i20, i20 N Line
- SEDANS: Aura, Verna
- SUVs: Exter, Venue, Venue N Line, Creta, Creta N Line, Alcazar, Tucson
- ELECTRIC: IONIQ 5

# Conversation Flow
1. Warm greeting and welcome
2. Ask about their car buying intentions
3. Understand their specific requirements (family size, budget, usage, fuel preference)
4. Recommend suitable models with detailed specifications
5. Offer test drive opportunities
6. Provide information about financing and next steps
7. Collect contact details if interested

# Key Questions to Ask
- "Are you considering buying a new car soon?"
- "Do you have a particular model in mind, or would you like me to show you our full lineup?"
- "What's your primary usage - daily commute, family trips, or city driving?"
- "Do you have any fuel preference - petrol, diesel, CNG, or are you interested in electric?"
- "Would you like to take a test drive today?"

Remember: Your goal is to provide excellent customer service and help them find the perfect Hyundai vehicle!
`,

  tools: [
    tool({
      name: "search_cars",
      description: "Search for cars based on customer requirements like car type, fuel type, mileage, etc.",
      parameters: {
        type: "object",
        properties: {
          car_type: {
            type: "string",
            enum: ["Hatchback", "Sedan", "SUV", "Electric"],
            description: "Type of car the customer is looking for"
          },
          fuel_type: {
            type: "string", 
            enum: ["Petrol", "Diesel", "CNG", "Electric"],
            description: "Preferred fuel type"
          },
          min_mileage: {
            type: "number",
            description: "Minimum mileage requirement in kmpl or km/kg"
          },
          max_budget_category: {
            type: "string",
            enum: ["Budget", "Mid-range", "Premium"],
            description: "Budget category - Budget (Grand i10, Aura), Mid-range (i20, Venue, Creta), Premium (Verna, Alcazar, Tucson, IONIQ)"
          }
        },
        required: [],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { car_type, fuel_type, min_mileage, max_budget_category } = input;
        
        let filteredCars: any[] = [];
        
        // Search through all cars
        Object.entries(CARS_DATA).forEach(([carName, variants]) => {
          variants.forEach(variant => {
            let matches = true;
            
            if (car_type && variant.carType !== car_type) {
              matches = false;
            }
            
            if (fuel_type && variant.fuelType !== fuel_type) {
              matches = false;
            }
            
            if (min_mileage && variant.mileage !== "ARAI range 631 km") {
              const mileageValue = parseFloat(variant.mileage);
              if (mileageValue < min_mileage) {
                matches = false;
              }
            }
            
            if (matches) {
              filteredCars.push({
                model: carName,
                ...variant
              });
            }
          });
        });
        
        return {
          cars: filteredCars,
          total_found: filteredCars.length,
          message: `Found ${filteredCars.length} cars matching your criteria`
        };
      },
    }),

    tool({
      name: "get_car_details",
      description: "Get detailed information about a specific car model",
      parameters: {
        type: "object",
        properties: {
          car_model: {
            type: "string",
            enum: ["Exter", "Grand i10 Nios", "i20", "i20 N Line", "Aura", "Venue", "Venue N Line", "Creta", "Creta N Line", "Alcazar", "Tucson", "Verna", "IONIQ 5"],
            description: "Name of the car model"
          }
        },
        required: ["car_model"],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { car_model } = input;
        
        const carData = CARS_DATA[car_model as keyof typeof CARS_DATA];
        
        if (!carData) {
          return {
            error: "Car model not found",
            available_models: Object.keys(CARS_DATA)
          };
        }
        
        return {
          model: car_model,
          variants: carData,
          total_variants: carData.length,
          car_type: carData[0].carType,
          message: `Here are all ${carData.length} variants of the ${car_model}`
        };
      },
    }),

    tool({
      name: "compare_cars",
      description: "Compare specifications between two or more car models",
      parameters: {
        type: "object",
        properties: {
          car_models: {
            type: "array",
            items: {
              type: "string",
              enum: ["Exter", "Grand i10 Nios", "i20", "i20 N Line", "Aura", "Venue", "Venue N Line", "Creta", "Creta N Line", "Alcazar", "Tucson", "Verna", "IONIQ 5"]
            },
            description: "Array of car models to compare"
          }
        },
        required: ["car_models"],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { car_models } = input;
        
        const comparison: any = {};
        
        car_models.forEach((model: string) => {
          const carData = CARS_DATA[model as keyof typeof CARS_DATA];
          if (carData) {
            comparison[model] = {
              car_type: carData[0].carType,
              variants: carData.length,
              fuel_options: [...new Set(carData.map(v => v.fuelType))],
              mileage_range: {
                min: Math.min(...carData.map(v => parseFloat(v.mileage) || 0)),
                max: Math.max(...carData.map(v => parseFloat(v.mileage) || 0))
              },
              power_range: carData.map(v => v.power)
            };
          }
        });
        
        return {
          comparison,
          models_compared: car_models,
          message: `Comparison ready for ${car_models.join(', ')}`
        };
      },
    }),

    tool({
      name: "schedule_test_drive",
      description: "Schedule a test drive appointment for interested customers",
      parameters: {
        type: "object",
        properties: {
          customer_name: {
            type: "string",
            description: "Customer's name"
          },
          phone_number: {
            type: "string",
            description: "Customer's contact number"
          },
          car_model: {
            type: "string",
            description: "Car model for test drive"
          },
          preferred_date: {
            type: "string",
            description: "Preferred date for test drive"
          },
          preferred_time: {
            type: "string",
            description: "Preferred time slot"
          }
        },
        required: ["customer_name", "phone_number", "car_model"],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { customer_name, phone_number, car_model, preferred_date, preferred_time } = input;
        
        const appointmentData = {
          customer_name,
          phone_number,
          car_model,
          preferred_date: preferred_date || "Next available",
          preferred_time: preferred_time || "Flexible",
          appointment_id: `TD-${Date.now()}`,
          showroom: "Hyundai Capital Showroom",
          status: "Scheduled"
        };

        console.log("🚗 Test Drive Appointment:");
        console.log("============================");
        console.log("Customer Name:", appointmentData.customer_name);
        console.log("Phone Number:", appointmentData.phone_number);
        console.log("Car Model:", appointmentData.car_model);
        console.log("Preferred Date:", appointmentData.preferred_date);
        console.log("Preferred Time:", appointmentData.preferred_time);
        console.log("Appointment ID:", appointmentData.appointment_id);
        console.log("Timestamp:", new Date().toISOString());
        console.log("============================");
        
        return {
          success: true,
          message: "Test drive appointment scheduled successfully!",
          appointment_id: appointmentData.appointment_id,
          appointmentData
        };
      },
    }),

    tool({
      name: "get_financing_options",
      description: "Provide information about financing options and EMI details",
      parameters: {
        type: "object",
        properties: {
          car_model: {
            type: "string",
            description: "Car model for financing calculation"
          },
          down_payment: {
            type: "number",
            description: "Down payment amount"
          },
          loan_tenure: {
            type: "number",
            description: "Loan tenure in years"
          }
        },
        required: ["car_model"],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { car_model, down_payment, loan_tenure } = input;
        
        // Sample financing information (in real implementation, this would come from actual finance partners)
        const financingOptions = {
          "Bank Loan": {
            interest_rate: "8.5% - 11.5%",
            processing_fee: "0.5% of loan amount",
            tenure: "1-7 years"
          },
          "Hyundai Finance": {
            interest_rate: "7.99% - 10.99%",
            processing_fee: "₹999 - ₹2999",
            tenure: "1-5 years",
            special_offers: "Zero down payment schemes available"
          },
          "Exchange Bonus": {
            additional_discount: "₹15,000 - ₹40,000",
            condition: "On exchange of old vehicle"
          }
        };
        
        return {
          car_model,
          financing_options: financingOptions,
          message: "Here are the available financing options for your Hyundai purchase",
          note: "Final rates subject to bank approval and credit score. Please visit showroom for exact calculations."
        };
      },
    })
  ],

  handoffs: [], // No handoffs needed for car showroom agent
});
