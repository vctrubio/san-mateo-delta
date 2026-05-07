# Finca San Mateo

A booking system replicate or airbnb. Where the host can manage bookings, send private invitations and track properties throughout the admin interface. 

## Goals 

- to manage properties
- to track booking, payments, and check in status
- drift away from airbnb, and have an atractive landing page and SEO.

## About

Finca San Mateo is located in Tarifa, Spain. It has 4 properties within the FINCA (ESTATE). It is 300 meters from the beach. Tarifa is a windy place that attracts tourism of kite surf, wind surf, and wing foil.

## Properties

Slug, Title, Max Guest
1. Levante – The Villa | Sleeps 6
2. Estrecho – The Residence | Sleeps 4
3. Marea – The Retreat | Sleeps 2
4. Cala – The Bungalow | Sleeps 2


## Arquitetchture

- Neon for serveless postgress
- cloudinary for property buckets (slugs)
- /admin route for admin ... /admin/bookings /admin/users /admin/properties
- finca/[proerty.slug] for specific view of property infomation and availibility
- /guest route for auth users
- /login for authentication
- /booking for viewing of specific booking 
