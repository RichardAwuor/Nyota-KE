CREATE TABLE "gig_broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gig_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gigs" ADD COLUMN "selected_provider_id" uuid;--> statement-breakpoint
ALTER TABLE "gigs" ADD COLUMN "selection_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gigs" ADD COLUMN "broadcast_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gigs" ADD COLUMN "direct_offer_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gig_broadcasts" ADD CONSTRAINT "gig_broadcasts_gig_id_gigs_id_fk" FOREIGN KEY ("gig_id") REFERENCES "public"."gigs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_broadcasts" ADD CONSTRAINT "gig_broadcasts_provider_id_service_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."service_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gigs" ADD CONSTRAINT "gigs_selected_provider_id_service_providers_id_fk" FOREIGN KEY ("selected_provider_id") REFERENCES "public"."service_providers"("id") ON DELETE set null ON UPDATE no action;