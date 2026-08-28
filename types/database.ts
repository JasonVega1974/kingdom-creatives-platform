export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          body: string
          church_id: string
          created_at: string | null
          expires_at: string | null
          id: string
          posted_by: string | null
          sort_order: number
          updated_at: string | null
          visible: boolean
        }
        Insert: {
          body: string
          church_id: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          posted_by?: string | null
          sort_order?: number
          updated_at?: string | null
          visible?: boolean
        }
        Update: {
          body?: string
          church_id?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          posted_by?: string | null
          sort_order?: number
          updated_at?: string | null
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "announcements_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      church_links: {
        Row: {
          church_id: string
          created_at: string | null
          external_id: string | null
          id: string
          is_primary: boolean
          kind: string
          label: string
          platform: string
          sort_order: number
          updated_at: string | null
          url: string
        }
        Insert: {
          church_id: string
          created_at?: string | null
          external_id?: string | null
          id?: string
          is_primary?: boolean
          kind: string
          label: string
          platform: string
          sort_order?: number
          updated_at?: string | null
          url: string
        }
        Update: {
          church_id?: string
          created_at?: string | null
          external_id?: string | null
          id?: string
          is_primary?: boolean
          kind?: string
          label?: string
          platform?: string
          sort_order?: number
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "church_links_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      church_media: {
        Row: {
          alt_text: string | null
          byte_size: number | null
          church_id: string
          created_at: string
          gallery_order: number
          height: number | null
          id: string
          in_gallery: boolean
          mime_type: string | null
          storage_path: string
          title: string | null
          updated_at: string
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          byte_size?: number | null
          church_id: string
          created_at?: string
          gallery_order?: number
          height?: number | null
          id?: string
          in_gallery?: boolean
          mime_type?: string | null
          storage_path: string
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          byte_size?: number | null
          church_id?: string
          created_at?: string
          gallery_order?: number
          height?: number | null
          id?: string
          in_gallery?: boolean
          mime_type?: string | null
          storage_path?: string
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "church_media_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      church_members: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          church_id: string
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          church_id: string
          created_at?: string | null
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          church_id?: string
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "church_members_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      church_sections: {
        Row: {
          church_id: string
          content: Json
          id: string
          page_slug: string
          section_key: string
          sort_order: number
          updated_at: string | null
          updated_by: string | null
          visible: boolean
        }
        Insert: {
          church_id: string
          content?: Json
          id?: string
          page_slug?: string
          section_key: string
          sort_order?: number
          updated_at?: string | null
          updated_by?: string | null
          visible?: boolean
        }
        Update: {
          church_id?: string
          content?: Json
          id?: string
          page_slug?: string
          section_key?: string
          sort_order?: number
          updated_at?: string | null
          updated_by?: string | null
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "church_sections_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      church_theme: {
        Row: {
          church_id: string
          color_accent: string
          color_primary: string
          color_secondary: string
          font_body: string | null
          font_heading: string | null
          logo_media_id: string | null
          logo_url: string | null
          updated_at: string | null
        }
        Insert: {
          church_id: string
          color_accent?: string
          color_primary?: string
          color_secondary?: string
          font_body?: string | null
          font_heading?: string | null
          logo_media_id?: string | null
          logo_url?: string | null
          updated_at?: string | null
        }
        Update: {
          church_id?: string
          color_accent?: string
          color_primary?: string
          color_secondary?: string
          font_body?: string | null
          font_heading?: string | null
          logo_media_id?: string | null
          logo_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "church_theme_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: true
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "church_theme_logo_media_fkey"
            columns: ["logo_media_id", "church_id"]
            isOneToOne: false
            referencedRelation: "church_media"
            referencedColumns: ["id", "church_id"]
          },
        ]
      }
      churches: {
        Row: {
          address: string | null
          created_at: string | null
          custom_domain: string | null
          email: string | null
          giving_mode: string
          giving_url: string | null
          id: string
          name: string | null
          phone: string | null
          service_times: Json | null
          slug: string
          status: string
          tagline: string | null
          template_id: string | null
          updated_at: string | null
          youtube_channel_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          custom_domain?: string | null
          email?: string | null
          giving_mode?: string
          giving_url?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          service_times?: Json | null
          slug: string
          status?: string
          tagline?: string | null
          template_id?: string | null
          updated_at?: string | null
          youtube_channel_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          custom_domain?: string | null
          email?: string | null
          giving_mode?: string
          giving_url?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          service_times?: Json | null
          slug?: string
          status?: string
          tagline?: string | null
          template_id?: string | null
          updated_at?: string | null
          youtube_channel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "churches_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_list_memberships: {
        Row: {
          added_at: string | null
          contact_id: string
          list_id: string
        }
        Insert: {
          added_at?: string | null
          contact_id: string
          list_id: string
        }
        Update: {
          added_at?: string | null
          contact_id?: string
          list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_list_memberships_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_list_memberships_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "email_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          church_id: string
          created_at: string | null
          email: string | null
          id: string
          message: string | null
          name: string | null
          phone: string | null
          subject: string | null
          tags: string[] | null
          type: string
        }
        Insert: {
          church_id: string
          created_at?: string | null
          email?: string | null
          id?: string
          message?: string | null
          name?: string | null
          phone?: string | null
          subject?: string | null
          tags?: string[] | null
          type?: string
        }
        Update: {
          church_id?: string
          created_at?: string | null
          email?: string | null
          id?: string
          message?: string | null
          name?: string | null
          phone?: string | null
          subject?: string | null
          tags?: string[] | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string | null
          church_id: string
          created_at: string | null
          id: string
          storage_path: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          church_id: string
          created_at?: string | null
          id?: string
          storage_path: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          church_id?: string
          created_at?: string | null
          id?: string
          storage_path?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      email_lists: {
        Row: {
          church_id: string
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          church_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          church_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_lists_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          church_id: string
          created_at: string | null
          description: string | null
          ends_at: string | null
          event_type: string | null
          id: string
          image_url: string | null
          location: string | null
          media_id: string | null
          published: boolean
          recurrence_rule: string | null
          registration_url: string | null
          starts_at: string
          title: string
          updated_at: string | null
        }
        Insert: {
          church_id: string
          created_at?: string | null
          description?: string | null
          ends_at?: string | null
          event_type?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          media_id?: string | null
          published?: boolean
          recurrence_rule?: string | null
          registration_url?: string | null
          starts_at: string
          title: string
          updated_at?: string | null
        }
        Update: {
          church_id?: string
          created_at?: string | null
          description?: string | null
          ends_at?: string | null
          event_type?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          media_id?: string | null
          published?: boolean
          recurrence_rule?: string | null
          registration_url?: string | null
          starts_at?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_media_fkey"
            columns: ["media_id", "church_id"]
            isOneToOne: false
            referencedRelation: "church_media"
            referencedColumns: ["id", "church_id"]
          },
        ]
      }
      gallery: {
        Row: {
          alt_text: string | null
          caption: string | null
          church_id: string
          created_at: string | null
          id: string
          image_url: string
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          alt_text?: string | null
          caption?: string | null
          church_id: string
          created_at?: string | null
          id?: string
          image_url: string
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          alt_text?: string | null
          caption?: string | null
          church_id?: string
          created_at?: string | null
          id?: string
          image_url?: string
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      gifts: {
        Row: {
          amount_cents: number
          church_id: string
          created_at: string | null
          currency: string
          donor_email: string | null
          donor_name: string | null
          frequency: string
          fund: string | null
          id: string
          status: string
          stripe_session_id: string | null
        }
        Insert: {
          amount_cents: number
          church_id: string
          created_at?: string | null
          currency?: string
          donor_email?: string | null
          donor_name?: string | null
          frequency?: string
          fund?: string | null
          id?: string
          status?: string
          stripe_session_id?: string | null
        }
        Update: {
          amount_cents?: number
          church_id?: string
          created_at?: string | null
          currency?: string
          donor_email?: string | null
          donor_name?: string | null
          frequency?: string
          fund?: string | null
          id?: string
          status?: string
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gifts_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          church_id: string
          created_at: string | null
          description: string | null
          frequency: string
          id: string
          image_path: string | null
          leader_name: string | null
          location_detail: string | null
          location_type: string
          media_id: string | null
          meeting_day: string | null
          meeting_link: string | null
          meeting_time: string | null
          meeting_tz: string | null
          name: string
          sort_order: number
          updated_at: string | null
          visible: boolean
        }
        Insert: {
          church_id: string
          created_at?: string | null
          description?: string | null
          frequency?: string
          id?: string
          image_path?: string | null
          leader_name?: string | null
          location_detail?: string | null
          location_type?: string
          media_id?: string | null
          meeting_day?: string | null
          meeting_link?: string | null
          meeting_time?: string | null
          meeting_tz?: string | null
          name: string
          sort_order?: number
          updated_at?: string | null
          visible?: boolean
        }
        Update: {
          church_id?: string
          created_at?: string | null
          description?: string | null
          frequency?: string
          id?: string
          image_path?: string | null
          leader_name?: string | null
          location_detail?: string | null
          location_type?: string
          media_id?: string | null
          meeting_day?: string | null
          meeting_link?: string | null
          meeting_time?: string | null
          meeting_tz?: string | null
          name?: string
          sort_order?: number
          updated_at?: string | null
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "groups_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_media_fkey"
            columns: ["media_id", "church_id"]
            isOneToOne: false
            referencedRelation: "church_media"
            referencedColumns: ["id", "church_id"]
          },
        ]
      }
      ministries: {
        Row: {
          church_id: string
          created_at: string | null
          description: string | null
          id: string
          logo_url: string | null
          name: string
          sort_order: number
          updated_at: string | null
          visible: boolean
          website_url: string | null
        }
        Insert: {
          church_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          sort_order?: number
          updated_at?: string | null
          visible?: boolean
          website_url?: string | null
        }
        Update: {
          church_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          sort_order?: number
          updated_at?: string | null
          visible?: boolean
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ministries_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      pastor_notes: {
        Row: {
          body: string | null
          body_iv: string | null
          category: string
          church_id: string
          created_at: string | null
          id: string
          tags: string[] | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          body_iv?: string | null
          category?: string
          church_id: string
          created_at?: string | null
          id?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          body_iv?: string | null
          category?: string
          church_id?: string
          created_at?: string | null
          id?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pastor_notes_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          body: string
          church_id: string
          created_at: string | null
          display_name: string | null
          id: string
          prayed_count: number
          status: string
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          body: string
          church_id: string
          created_at?: string | null
          display_name?: string | null
          id?: string
          prayed_count?: number
          status?: string
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          body?: string
          church_id?: string
          created_at?: string | null
          display_name?: string | null
          id?: string
          prayed_count?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prayer_requests_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      sermons: {
        Row: {
          body: string | null
          bulletin_notes: string | null
          church_id: string
          created_at: string | null
          created_by: string | null
          devotional: string | null
          duration_min: number | null
          id: string
          kids_lesson: string | null
          preached_at: string | null
          published_at: string | null
          scripture_ref: string | null
          series: string | null
          slide_content: string | null
          small_group_questions: string | null
          social_posts: string | null
          status: string
          style: string | null
          summary: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          youtube_id: string | null
        }
        Insert: {
          body?: string | null
          bulletin_notes?: string | null
          church_id: string
          created_at?: string | null
          created_by?: string | null
          devotional?: string | null
          duration_min?: number | null
          id?: string
          kids_lesson?: string | null
          preached_at?: string | null
          published_at?: string | null
          scripture_ref?: string | null
          series?: string | null
          slide_content?: string | null
          small_group_questions?: string | null
          social_posts?: string | null
          status?: string
          style?: string | null
          summary?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          youtube_id?: string | null
        }
        Update: {
          body?: string | null
          bulletin_notes?: string | null
          church_id?: string
          created_at?: string | null
          created_by?: string | null
          devotional?: string | null
          duration_min?: number | null
          id?: string
          kids_lesson?: string | null
          preached_at?: string | null
          published_at?: string | null
          scripture_ref?: string | null
          series?: string | null
          slide_content?: string | null
          small_group_questions?: string | null
          social_posts?: string | null
          status?: string
          style?: string | null
          summary?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          youtube_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sermons_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          bio: string | null
          church_id: string
          created_at: string | null
          email: string | null
          id: string
          media_id: string | null
          name: string
          phone: string | null
          photo_url: string | null
          role_title: string | null
          sort_order: number
          updated_at: string | null
          visible: boolean
        }
        Insert: {
          bio?: string | null
          church_id: string
          created_at?: string | null
          email?: string | null
          id?: string
          media_id?: string | null
          name: string
          phone?: string | null
          photo_url?: string | null
          role_title?: string | null
          sort_order?: number
          updated_at?: string | null
          visible?: boolean
        }
        Update: {
          bio?: string | null
          church_id?: string
          created_at?: string | null
          email?: string | null
          id?: string
          media_id?: string | null
          name?: string
          phone?: string | null
          photo_url?: string | null
          role_title?: string | null
          sort_order?: number
          updated_at?: string | null
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "staff_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_media_fkey"
            columns: ["media_id", "church_id"]
            isOneToOne: false
            referencedRelation: "church_media"
            referencedColumns: ["id", "church_id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          body: string | null
          church_id: string
          created_at: string | null
          created_by: string | null
          id: string
          status: string
          subject: string
        }
        Insert: {
          body?: string | null
          church_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          status?: string
          subject: string
        }
        Update: {
          body?: string | null
          church_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          created_at: string | null
          default_theme: Json
          description: string | null
          id: string
          is_active: boolean
          name: string
          preview_image_url: string | null
        }
        Insert: {
          created_at?: string | null
          default_theme?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          preview_image_url?: string | null
        }
        Update: {
          created_at?: string | null
          default_theme?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          preview_image_url?: string | null
        }
        Relationships: []
      }
      videos: {
        Row: {
          category: string
          church_id: string
          created_at: string | null
          description: string | null
          duration_min: number | null
          id: string
          published: boolean
          sort_order: number
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          video_url: string
          youtube_id: string | null
        }
        Insert: {
          category?: string
          church_id: string
          created_at?: string | null
          description?: string | null
          duration_min?: number | null
          id?: string
          published?: boolean
          sort_order?: number
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          video_url: string
          youtube_id?: string | null
        }
        Update: {
          category?: string
          church_id?: string
          created_at?: string | null
          description?: string | null
          duration_min?: number | null
          id?: string
          published?: boolean
          sort_order?: number
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          video_url?: string
          youtube_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_prayer_count: {
        Args: { request_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
