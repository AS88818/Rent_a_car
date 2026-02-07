import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Vehicle {
  id: string;
  reg_number: string;
  mot_expiry: string;
  mot_not_applicable?: boolean;
  insurance_expiry: string;
  current_mileage: number;
  next_service_mileage?: number;
  health_flag: string;
  deleted_at?: string;
}

interface AlertResult {
  type: string;
  vehicle_id: string;
  vehicle_reg: string;
  priority: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
}

function daysUntilDate(dateString: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(dateString);
  targetDate.setHours(0, 0, 0, 0);
  const diffTime = targetDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function generateAlerts(vehicles: Vehicle[]): AlertResult[] {
  const alerts: AlertResult[] = [];
  const alertThresholds = [30, 14, 7, 3, 1, 0];

  for (const vehicle of vehicles) {
    if (vehicle.deleted_at) continue;

    if (!vehicle.mot_not_applicable && vehicle.mot_expiry) {
      const daysUntilMot = daysUntilDate(vehicle.mot_expiry);

      if (daysUntilMot <= 30 && daysUntilMot >= 0) {
        let priority: 'urgent' | 'warning' | 'info' = 'info';
        let title = 'MOT Expiring Soon';

        if (daysUntilMot <= 3) {
          priority = 'urgent';
          title = 'MOT Expiring Very Soon';
        } else if (daysUntilMot <= 7) {
          priority = 'warning';
          title = 'MOT Expiring This Week';
        } else if (daysUntilMot <= 14) {
          priority = 'warning';
        }

        alerts.push({
          type: 'mot_expiring',
          vehicle_id: vehicle.id,
          vehicle_reg: vehicle.reg_number,
          priority,
          title,
          message: `${vehicle.reg_number} MOT expires in ${daysUntilMot} day${daysUntilMot !== 1 ? 's' : ''} (${new Date(vehicle.mot_expiry).toLocaleDateString()})`,
          metadata: {
            days_until_expiry: daysUntilMot,
            expiry_date: vehicle.mot_expiry,
          },
        });
      } else if (daysUntilMot < 0) {
        alerts.push({
          type: 'mot_expiring',
          vehicle_id: vehicle.id,
          vehicle_reg: vehicle.reg_number,
          priority: 'urgent',
          title: 'MOT Expired',
          message: `${vehicle.reg_number} MOT has EXPIRED (expired ${Math.abs(daysUntilMot)} day${Math.abs(daysUntilMot) !== 1 ? 's' : ''} ago)`,
          metadata: {
            days_until_expiry: daysUntilMot,
            expiry_date: vehicle.mot_expiry,
          },
        });
      }
    }

    if (vehicle.insurance_expiry) {
      const daysUntilInsurance = daysUntilDate(vehicle.insurance_expiry);

      if (daysUntilInsurance <= 30 && daysUntilInsurance >= 0) {
        let priority: 'urgent' | 'warning' | 'info' = 'info';
        let title = 'Insurance Expiring Soon';

        if (daysUntilInsurance <= 3) {
          priority = 'urgent';
          title = 'Insurance Expiring Very Soon';
        } else if (daysUntilInsurance <= 7) {
          priority = 'warning';
          title = 'Insurance Expiring This Week';
        } else if (daysUntilInsurance <= 14) {
          priority = 'warning';
        }

        alerts.push({
          type: 'insurance_expiring',
          vehicle_id: vehicle.id,
          vehicle_reg: vehicle.reg_number,
          priority,
          title,
          message: `${vehicle.reg_number} insurance expires in ${daysUntilInsurance} day${daysUntilInsurance !== 1 ? 's' : ''} (${new Date(vehicle.insurance_expiry).toLocaleDateString()})`,
          metadata: {
            days_until_expiry: daysUntilInsurance,
            expiry_date: vehicle.insurance_expiry,
          },
        });
      } else if (daysUntilInsurance < 0) {
        alerts.push({
          type: 'insurance_expiring',
          vehicle_id: vehicle.id,
          vehicle_reg: vehicle.reg_number,
          priority: 'urgent',
          title: 'Insurance Expired',
          message: `${vehicle.reg_number} insurance has EXPIRED (expired ${Math.abs(daysUntilInsurance)} day${Math.abs(daysUntilInsurance) !== 1 ? 's' : ''} ago)`,
          metadata: {
            days_until_expiry: daysUntilInsurance,
            expiry_date: vehicle.insurance_expiry,
          },
        });
      }
    }

    if (vehicle.next_service_mileage) {
      const kmRemaining = vehicle.next_service_mileage - vehicle.current_mileage;

      if (kmRemaining < 0) {
        alerts.push({
          type: 'service_due',
          vehicle_id: vehicle.id,
          vehicle_reg: vehicle.reg_number,
          priority: 'urgent',
          title: 'Service Overdue',
          message: `${vehicle.reg_number} service is OVERDUE by ${Math.abs(kmRemaining).toLocaleString()} km`,
          metadata: {
            km_remaining: kmRemaining,
            current_mileage: vehicle.current_mileage,
            service_due_at: vehicle.next_service_mileage,
          },
        });
      } else if (kmRemaining <= 500) {
        alerts.push({
          type: 'service_due',
          vehicle_id: vehicle.id,
          vehicle_reg: vehicle.reg_number,
          priority: 'urgent',
          title: 'Service Due Very Soon',
          message: `${vehicle.reg_number} service due in ${kmRemaining.toLocaleString()} km`,
          metadata: {
            km_remaining: kmRemaining,
            current_mileage: vehicle.current_mileage,
            service_due_at: vehicle.next_service_mileage,
          },
        });
      } else if (kmRemaining <= 1000) {
        alerts.push({
          type: 'service_due',
          vehicle_id: vehicle.id,
          vehicle_reg: vehicle.reg_number,
          priority: 'warning',
          title: 'Service Due Soon',
          message: `${vehicle.reg_number} service due in ${kmRemaining.toLocaleString()} km`,
          metadata: {
            km_remaining: kmRemaining,
            current_mileage: vehicle.current_mileage,
            service_due_at: vehicle.next_service_mileage,
          },
        });
      }
    }

    if (vehicle.health_flag === 'Grounded') {
      alerts.push({
        type: 'vehicle_grounded',
        vehicle_id: vehicle.id,
        vehicle_reg: vehicle.reg_number,
        priority: 'warning',
        title: 'Vehicle Grounded',
        message: `${vehicle.reg_number} is currently grounded and unavailable for bookings`,
        metadata: {
          health_flag: vehicle.health_flag,
        },
      });
    }
  }

  return alerts;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: vehicles, error: vehiclesError } = await supabase
      .from("vehicles")
      .select("id, reg_number, mot_expiry, mot_not_applicable, insurance_expiry, current_mileage, next_service_mileage, health_flag, deleted_at")
      .is("deleted_at", null);

    if (vehiclesError) {
      throw new Error(`Failed to fetch vehicles: ${vehiclesError.message}`);
    }

    const { data: adminManagers, error: usersError } = await supabase
      .from("users")
      .select("id")
      .in("role", ["admin", "manager"])
      .is("deleted_at", null);

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    const alerts = generateAlerts(vehicles as Vehicle[]);

    let notificationsCreated = 0;
    let notificationsSkipped = 0;

    for (const alert of alerts) {
      for (const user of adminManagers || []) {
        const { data: existingNotification } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", user.id)
          .eq("type", alert.type)
          .eq("read", false)
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .contains("metadata", { vehicle_id: alert.vehicle_id })
          .maybeSingle();

        if (existingNotification) {
          notificationsSkipped++;
          continue;
        }

        const { error: insertError } = await supabase
          .from("notifications")
          .insert({
            user_id: user.id,
            type: alert.type,
            title: alert.title,
            message: alert.message,
            link: `/vehicles/${alert.vehicle_id}`,
            priority: alert.priority,
            metadata: {
              ...alert.metadata,
              vehicle_id: alert.vehicle_id,
              vehicle_reg: alert.vehicle_reg,
            },
          });

        if (insertError) {
          console.error(`Failed to create notification: ${insertError.message}`);
        } else {
          notificationsCreated++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Vehicle alerts generated successfully",
        stats: {
          vehiclesChecked: vehicles?.length || 0,
          alertsGenerated: alerts.length,
          notificationsCreated,
          notificationsSkipped,
          recipientCount: adminManagers?.length || 0,
        },
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error generating vehicle alerts:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
