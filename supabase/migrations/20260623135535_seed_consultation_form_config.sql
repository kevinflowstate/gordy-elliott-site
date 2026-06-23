INSERT INTO public.form_config (form_type, config)
VALUES (
  'consultation',
  $json$
  {
    "title": "Initial Consultation",
    "description": "Help us personalise your coaching experience by filling in your details below.",
    "questions": [
      {
        "id": "date_of_birth",
        "label": "Date of Birth",
        "placeholder": "",
        "type": "date",
        "enabled": true
      },
      {
        "id": "sex",
        "label": "Sex",
        "placeholder": "",
        "type": "select",
        "options": ["Female", "Male", "Prefer not to say"],
        "enabled": true
      },
      {
        "id": "cycle_tracking_enabled",
        "label": "Cycle tracking",
        "placeholder": "Cycle tools will appear in your portal.",
        "type": "boolean",
        "enabled": true
      },
      {
        "id": "fitness_level",
        "label": "Current Fitness Level",
        "placeholder": "",
        "type": "select",
        "options": ["Beginner", "Intermediate", "Advanced"],
        "enabled": true,
        "required": true
      },
      {
        "id": "primary_goal",
        "label": "Primary Goal",
        "placeholder": "",
        "type": "select",
        "options": ["Weight Loss", "Muscle Gain", "General Fitness", "Sport Specific", "Flexibility & Mobility"],
        "enabled": true,
        "required": true
      },
      {
        "id": "training_days",
        "label": "Training Days Per Week",
        "placeholder": "",
        "type": "select",
        "options": ["2", "3", "4", "5", "6"],
        "enabled": true,
        "required": true
      },
      {
        "id": "equipment_access",
        "label": "Equipment Access",
        "placeholder": "",
        "type": "select",
        "options": ["Full Gym", "Home Gym", "Limited", "Bodyweight Only"],
        "enabled": true,
        "required": true
      },
      {
        "id": "dietary_preferences",
        "label": "Dietary Preferences or Restrictions",
        "placeholder": "e.g. vegetarian, lactose intolerant, no preferences...",
        "type": "textarea",
        "enabled": true
      },
      {
        "id": "injuries",
        "label": "Any Injuries or Limitations",
        "placeholder": "e.g. lower back issues, bad knee, none...",
        "type": "textarea",
        "enabled": true
      },
      {
        "id": "supplements",
        "label": "Current Supplements",
        "placeholder": "e.g. protein powder, creatine, none...",
        "type": "textarea",
        "enabled": true
      },
      {
        "id": "additional_info",
        "label": "Anything Else We Should Know",
        "placeholder": "Any other context that would help us personalise your coaching...",
        "type": "textarea",
        "enabled": true
      }
    ]
  }
  $json$::jsonb
)
ON CONFLICT (form_type) DO NOTHING;
