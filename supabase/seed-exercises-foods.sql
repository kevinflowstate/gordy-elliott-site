-- ============================================================
-- SEED DATA: exercises + foods
-- ============================================================

-- ============================================================
-- EXERCISES
-- ============================================================

-- CHEST (12)
INSERT INTO exercises (name, muscle_group, equipment, description) VALUES
('Flat Bench Press', 'chest', 'barbell', 'A horizontal pressing movement that targets the mid-chest by lowering a barbell to the sternum and pressing back to lockout.'),
('Incline Bench Press', 'chest', 'barbell', 'A pressing movement performed on a 30-45 degree incline to emphasise the upper chest and anterior deltoids.'),
('Decline Bench Press', 'chest', 'barbell', 'A pressing movement on a downward-angled bench that shifts emphasis to the lower chest fibres.'),
('Dumbbell Flyes', 'chest', 'dumbbell', 'An isolation exercise that stretches and contracts the pec fibres through a wide arc with a slight bend in the elbows.'),
('Cable Crossovers', 'chest', 'cable', 'A cable isolation movement that keeps constant tension on the pecs through the full range of motion.'),
('Push-Ups', 'chest', 'bodyweight', 'A fundamental pressing movement using bodyweight to work the chest, anterior delts, and triceps.'),
('Incline Dumbbell Press', 'chest', 'dumbbell', 'A dumbbell press on an incline bench that develops upper chest thickness while allowing greater range of motion than the barbell variation.'),
('Chest Dips', 'chest', 'bodyweight', 'A compound dip performed with a forward lean to maximise lower chest recruitment over the triceps.'),
('Pec Deck Machine', 'chest', 'machine', 'A machine fly variation that isolates the pectorals through a fixed arc with consistent resistance throughout.'),
('Floor Press', 'chest', 'barbell', 'A bench press variation performed lying on the floor that limits range of motion and removes leg drive, loading the chest and triceps directly.'),
('Landmine Press', 'chest', 'barbell', 'A unilateral or bilateral press using a barbell anchored at one end, emphasising the upper chest with a natural pressing angle.'),
('Dumbbell Bench Press', 'chest', 'dumbbell', 'A chest press using dumbbells that allows independent arm movement and a deeper stretch at the bottom position.');

-- BACK (14)
INSERT INTO exercises (name, muscle_group, equipment, description) VALUES
('Barbell Row', 'back', 'barbell', 'A hip-hinge rowing movement that builds thickness across the entire back, particularly the mid and lower lats.'),
('Lat Pulldown', 'back', 'machine', 'A machine-based vertical pull that develops lat width by pulling a bar from overhead to the upper chest.'),
('Seated Cable Row', 'back', 'cable', 'A horizontal pulling movement using a cable stack that works the mid-back, rhomboids, and biceps.'),
('Pull-Ups', 'back', 'bodyweight', 'A bodyweight vertical pull using a pronated grip that builds lat width, bicep strength, and grip endurance.'),
('Chin-Ups', 'back', 'bodyweight', 'A supinated-grip vertical pull that emphasises the lower lats and biceps compared to the standard pull-up.'),
('Single-Arm Dumbbell Row', 'back', 'dumbbell', 'A unilateral rowing movement braced on a bench that allows heavy loading and a full lat stretch per side.'),
('T-Bar Row', 'back', 'barbell', 'A bilateral row using a barbell fixed at one end, allowing heavy loading for overall back thickness.'),
('Face Pulls', 'back', 'cable', 'A cable rear-delt and upper-back exercise performed at face height using a rope attachment to improve shoulder health.'),
('Straight-Arm Pulldown', 'back', 'cable', 'A cable isolation movement that targets the lats through elbow extension with the arms kept straight throughout.'),
('Pendlay Row', 'back', 'barbell', 'A strict barbell row variation where the bar returns to the floor between each rep, emphasising explosive upper-back strength.'),
('Chest-Supported Row', 'back', 'dumbbell', 'A dumbbell row performed chest-down on an incline bench that eliminates momentum and isolates the mid-back.'),
('Inverted Row', 'back', 'bodyweight', 'A horizontal bodyweight row with feet elevated or on the floor, working the mid-back and biceps with scalable difficulty.'),
('Rack Pulls', 'back', 'barbell', 'A partial-range deadlift from a set rack height that overloads the upper back, traps, and spinal erectors.'),
('Meadows Row', 'back', 'barbell', 'A unilateral landmine row variation popularised by John Meadows that targets the upper lats with a unique loading angle.');

-- SHOULDERS (12)
INSERT INTO exercises (name, muscle_group, equipment, description) VALUES
('Overhead Press', 'shoulders', 'barbell', 'A standing or seated compound press that builds overall shoulder mass and overhead strength with a barbell.'),
('Lateral Raises', 'shoulders', 'dumbbell', 'An isolation movement that abducts the arm to develop width and definition in the medial deltoid.'),
('Front Raises', 'shoulders', 'dumbbell', 'A shoulder isolation exercise that lifts the dumbbells forward to target the anterior deltoid.'),
('Rear Delt Flyes', 'shoulders', 'dumbbell', 'A bent-over fly variation that isolates the rear deltoids and upper back to improve shoulder balance.'),
('Arnold Press', 'shoulders', 'dumbbell', 'A rotating dumbbell press created by Arnold Schwarzenegger that hits all three deltoid heads through its full range of motion.'),
('Upright Rows', 'shoulders', 'barbell', 'A pulling movement where the bar is drawn up along the torso to work the medial delts and upper traps.'),
('Cable Lateral Raises', 'shoulders', 'cable', 'A lateral raise variation using a cable for continuous tension on the medial delt throughout the entire arc.'),
('Dumbbell Shoulder Press', 'shoulders', 'dumbbell', 'A seated or standing overhead press with dumbbells that allows independent arm movement and a deeper bottom position.'),
('Band Pull-Aparts', 'shoulders', 'band', 'A resistance band exercise that strengthens the rear delts and external rotators by pulling the band apart at chest height.'),
('Z Press', 'shoulders', 'barbell', 'A seated overhead press performed on the floor with legs extended, demanding strict trunk stability and shoulder mobility.'),
('Push Press', 'shoulders', 'barbell', 'A dynamic overhead press that uses a slight leg drive to move heavier loads, overloading the top portion of the press.'),
('Plate Front Raise', 'shoulders', 'barbell', 'A front raise variation holding a weight plate that develops the anterior deltoids with a neutral grip.');

-- LEGS (18)
INSERT INTO exercises (name, muscle_group, equipment, description) VALUES
('Back Squat', 'legs', 'barbell', 'The foundational lower-body compound movement with a barbell across the upper back, developing the quads, glutes, and hamstrings.'),
('Front Squat', 'legs', 'barbell', 'A squat variation with the barbell held in a front rack position that emphasises the quads and requires significant upper-back strength.'),
('Romanian Deadlift', 'legs', 'barbell', 'A hip-hinge movement with a soft knee that maximally stretches and loads the hamstrings and glutes.'),
('Leg Press', 'legs', 'machine', 'A machine compound movement that allows heavy quad-focused loading with reduced spinal stress.'),
('Leg Curl', 'legs', 'machine', 'A machine isolation exercise that targets the hamstrings through knee flexion in a lying or seated position.'),
('Leg Extension', 'legs', 'machine', 'A machine isolation movement for the quadriceps performed through knee extension against resistance.'),
('Bulgarian Split Squat', 'legs', 'dumbbell', 'A unilateral squat with the rear foot elevated that heavily loads the quads and glutes while challenging balance.'),
('Goblet Squat', 'legs', 'dumbbell', 'A squat variation holding a dumbbell at chest height that reinforces upright posture and depth while targeting the quads.'),
('Lunges', 'legs', 'dumbbell', 'A unilateral stepping movement that develops quad, glute, and hamstring strength while improving balance and coordination.'),
('Hip Thrust', 'legs', 'barbell', 'A barbell glute exercise performed with shoulders on a bench, achieving maximum glute activation at the top of the movement.'),
('Sumo Deadlift', 'legs', 'barbell', 'A wide-stance deadlift variation that places greater demand on the inner thighs and glutes compared to the conventional stance.'),
('Calf Raises', 'legs', 'machine', 'A machine isolation movement that targets the gastrocnemius and soleus through plantarflexion under load.'),
('Hack Squat', 'legs', 'machine', 'A machine squat variation with a fixed movement path that heavily targets the quads with less spinal loading than free squats.'),
('Step-Ups', 'legs', 'dumbbell', 'A unilateral exercise stepping onto an elevated platform that trains the quads and glutes while improving single-leg stability.'),
('Glute Bridge', 'legs', 'bodyweight', 'A floor-based hip extension movement that activates and strengthens the glutes with no equipment required.'),
('Nordic Curl', 'legs', 'bodyweight', 'An advanced bodyweight exercise anchoring the feet to train eccentric hamstring strength through knee flexion.'),
('Wall Sit', 'legs', 'bodyweight', 'An isometric quad exercise holding a seated position against a wall to build muscular endurance in the lower body.'),
('Box Jumps', 'legs', 'bodyweight', 'A plyometric lower-body exercise jumping onto a box to develop explosive power in the quads, glutes, and calves.');

-- ARMS (14)
INSERT INTO exercises (name, muscle_group, equipment, description) VALUES
('Barbell Curl', 'arms', 'barbell', 'A fundamental bicep exercise curling a barbell through full elbow flexion for maximum bicep loading.'),
('Dumbbell Curl', 'arms', 'dumbbell', 'A standard bicep curl with dumbbells that allows supination through the movement for peak bicep contraction.'),
('Hammer Curl', 'arms', 'dumbbell', 'A neutral-grip curl that targets the brachialis and brachioradialis alongside the bicep for overall arm thickness.'),
('Preacher Curl', 'arms', 'barbell', 'A strict bicep curl performed on a preacher bench that eliminates momentum and isolates the lower bicep.'),
('Tricep Pushdown', 'arms', 'cable', 'A cable isolation exercise for the triceps performed by pushing a bar or rope attachment down to full elbow extension.'),
('Skull Crushers', 'arms', 'barbell', 'A lying tricep extension that lowers the bar toward the forehead, placing the long head of the tricep under significant stretch.'),
('Overhead Tricep Extension', 'arms', 'dumbbell', 'A dumbbell tricep exercise performed overhead to maximally stretch and work the long head of the tricep.'),
('Close-Grip Bench Press', 'arms', 'barbell', 'A bench press with a narrow grip that shifts loading from the chest to the triceps for mass and strength.'),
('Concentration Curl', 'arms', 'dumbbell', 'A seated unilateral curl braced against the inner thigh that isolates the bicep peak with strict form.'),
('Cable Curl', 'arms', 'cable', 'A bicep curl using a cable attachment that provides continuous tension throughout the range of motion.'),
('Tricep Dips', 'arms', 'bodyweight', 'A bodyweight compound movement between two parallel bars or a bench that primarily targets the triceps.'),
('Diamond Push-Ups', 'arms', 'bodyweight', 'A push-up variation with hands forming a diamond shape under the chest to emphasise tricep activation.'),
('Reverse Curl', 'arms', 'barbell', 'A pronated-grip curl that targets the brachioradialis and improves forearm strength and grip endurance.'),
('Zottman Curl', 'arms', 'dumbbell', 'A curl that supinates on the way up and pronates on the way down to work both the biceps and forearms in a single rep.');

-- CORE (12)
INSERT INTO exercises (name, muscle_group, equipment, description) VALUES
('Plank', 'core', 'bodyweight', 'An isometric hold in a push-up position that builds anti-extension core stability and total-body tension.'),
('Dead Bug', 'core', 'bodyweight', 'A supine exercise that trains deep core stability by extending opposite limbs while keeping the lower back pressed flat.'),
('Russian Twist', 'core', 'bodyweight', 'A rotational core exercise performed in a V-sit position that targets the obliques and transverse abdominis.'),
('Cable Woodchop', 'core', 'cable', 'A rotational cable exercise mimicking a chopping motion to develop rotational core strength and oblique power.'),
('Ab Rollout', 'core', 'bodyweight', 'An advanced anti-extension exercise using an ab wheel that challenges the entire core from a kneeling or standing position.'),
('Hanging Leg Raise', 'core', 'bodyweight', 'A challenging core exercise hanging from a bar that targets the lower abs and hip flexors through leg elevation.'),
('Bicycle Crunch', 'core', 'bodyweight', 'A dynamic crunch variation rotating elbow to opposite knee that activates the rectus abdominis and obliques.'),
('Pallof Press', 'core', 'cable', 'An anti-rotation cable exercise pressing a handle away from the chest to build lateral core stability.'),
('Side Plank', 'core', 'bodyweight', 'An isometric lateral hold that targets the obliques and quadratus lumborum for frontal-plane core stability.'),
('Mountain Climbers', 'core', 'bodyweight', 'A dynamic core exercise driving alternating knees toward the chest from a plank position, raising the heart rate.'),
('V-Ups', 'core', 'bodyweight', 'A demanding core exercise simultaneously raising the legs and torso to form a V-shape, targeting the full abdominal wall.'),
('Flutter Kicks', 'core', 'bodyweight', 'A supine exercise alternating small leg kicks to work the lower abs and hip flexors through sustained tension.');

-- CARDIO (10)
INSERT INTO exercises (name, muscle_group, equipment, description) VALUES
('Treadmill Run', 'cardio', 'machine', 'A steady-state or interval cardiovascular exercise on a motorised treadmill to improve aerobic capacity and burn calories.'),
('Rowing Machine', 'cardio', 'machine', 'A full-body low-impact cardio exercise on an ergometer that develops cardiovascular fitness and works the back, legs, and arms.'),
('Assault Bike', 'cardio', 'machine', 'A high-intensity air resistance bike that works the arms and legs simultaneously, often used for interval conditioning.'),
('Battle Ropes', 'cardio', 'none', 'A high-intensity conditioning exercise using heavy ropes to create waves, building power endurance and cardiovascular fitness.'),
('Jumping Jacks', 'cardio', 'bodyweight', 'A classic whole-body cardiovascular exercise involving simultaneous arm and leg abduction and adduction.'),
('Burpees', 'cardio', 'bodyweight', 'A full-body compound conditioning movement combining a squat, plank, push-up, and jump for maximum caloric output.'),
('Sled Push', 'cardio', 'none', 'A loaded conditioning exercise driving a weighted sled across a surface to develop leg power and cardiovascular endurance.'),
('Farmer''s Walk', 'cardio', 'dumbbell', 'A loaded carry exercise walking with heavy dumbbells to build grip strength, core stability, and cardiovascular conditioning.'),
('Jump Rope', 'cardio', 'none', 'A rhythmic cardiovascular exercise skipping a rope that improves coordination, footwork, and aerobic fitness.'),
('Stairmaster', 'cardio', 'machine', 'A stepping machine that simulates stair climbing to improve cardiovascular fitness and develop the glutes and quads.');

-- FULL BODY (10)
INSERT INTO exercises (name, muscle_group, equipment, description) VALUES
('Deadlift', 'full_body', 'barbell', 'The king of posterior-chain exercises, lifting a barbell from the floor to hip height to build total-body strength and muscle.'),
('Clean and Press', 'full_body', 'barbell', 'An Olympic-derived movement combining a power clean with an overhead press to develop full-body power and coordination.'),
('Thrusters', 'full_body', 'barbell', 'A combination of a front squat and overhead press performed in one fluid movement, commonly used in conditioning circuits.'),
('Turkish Get-Up', 'full_body', 'kettlebell', 'A complex kettlebell movement rising from the floor to standing while holding a weight overhead, building stability and coordination.'),
('Kettlebell Swing', 'full_body', 'kettlebell', 'A ballistic hip-hinge movement swinging a kettlebell to shoulder height that develops posterior-chain power and cardiovascular fitness.'),
('Man Maker', 'full_body', 'dumbbell', 'A demanding combination of a push-up, dumbbell rows, squat, and press performed with dumbbells in one continuous sequence.'),
('Bear Crawl', 'full_body', 'bodyweight', 'A locomotive movement on hands and feet with knees hovering that builds total-body coordination, core strength, and endurance.'),
('Snatch', 'full_body', 'barbell', 'An Olympic weightlifting movement pulling a barbell from the floor to overhead in one motion to develop explosive full-body power.'),
('Wall Balls', 'full_body', 'none', 'A conditioning exercise combining a squat and overhead throw against a wall with a medicine ball to develop power and endurance.'),
('Devil Press', 'full_body', 'dumbbell', 'A burpee variation with dumbbells finishing with a double dumbbell snatch, combining conditioning and strength in one movement.');


-- ============================================================
-- FOODS
-- ============================================================

-- PROTEIN (14)
INSERT INTO foods (name, category, serving_size, calories, protein_g, carbs_g, fat_g, fibre_g) VALUES
('Chicken Breast', 'protein', '150g', 231, 43.5, 0.0, 5.0, 0.0),
('Turkey Mince', 'protein', '100g', 149, 19.5, 0.0, 8.0, 0.0),
('Salmon Fillet', 'protein', '130g', 271, 28.5, 0.0, 17.0, 0.0),
('Cod Fillet', 'protein', '150g', 126, 28.5, 0.0, 1.0, 0.0),
('Tuna Tinned in Water', 'protein', '100g', 116, 26.0, 0.0, 1.0, 0.0),
('Lean Beef Mince 5%', 'protein', '100g', 137, 21.0, 0.0, 5.5, 0.0),
('Sirloin Steak', 'protein', '200g', 342, 50.0, 0.0, 15.0, 0.0),
('Pork Loin', 'protein', '150g', 234, 36.0, 0.0, 9.5, 0.0),
('Prawns', 'protein', '100g', 99, 20.0, 0.0, 1.5, 0.0),
('Tofu', 'protein', '100g', 73, 8.0, 1.5, 4.0, 0.3),
('Tempeh', 'protein', '100g', 193, 19.0, 9.0, 11.0, 0.0),
('Whey Protein', 'protein', '30g scoop', 113, 22.0, 3.5, 1.5, 0.0),
('Casein Protein', 'protein', '30g scoop', 110, 24.0, 2.0, 1.0, 0.0),
('Eggs', 'protein', '2 large (120g)', 172, 14.5, 0.8, 12.0, 0.0);

-- DAIRY (8)
INSERT INTO foods (name, category, serving_size, calories, protein_g, carbs_g, fat_g, fibre_g) VALUES
('Whole Milk', 'dairy', '250ml', 163, 8.0, 12.0, 9.5, 0.0),
('Semi-Skimmed Milk', 'dairy', '250ml', 118, 8.5, 12.0, 4.0, 0.0),
('Greek Yoghurt', 'dairy', '150g', 133, 17.0, 5.5, 4.5, 0.0),
('Cottage Cheese', 'dairy', '100g', 98, 11.0, 3.5, 4.5, 0.0),
('Cheddar Cheese', 'dairy', '30g', 124, 7.5, 0.1, 10.5, 0.0),
('Mozzarella', 'dairy', '30g', 72, 5.5, 0.5, 5.5, 0.0),
('Feta Cheese', 'dairy', '30g', 75, 4.0, 0.5, 6.0, 0.0),
('Skyr', 'dairy', '150g', 90, 15.0, 6.0, 0.5, 0.0);

-- GRAINS (10)
INSERT INTO foods (name, category, serving_size, calories, protein_g, carbs_g, fat_g, fibre_g) VALUES
('White Rice Cooked', 'grains', '150g', 195, 3.5, 43.0, 0.5, 0.5),
('Brown Rice Cooked', 'grains', '150g', 165, 3.5, 34.0, 1.5, 1.8),
('Porridge Oats', 'grains', '40g dry', 152, 5.0, 26.0, 3.5, 3.0),
('Wholemeal Bread', 'grains', '2 slices (80g)', 168, 7.5, 29.0, 2.5, 5.0),
('White Pasta Cooked', 'grains', '200g', 260, 9.0, 52.0, 1.5, 1.5),
('Wholemeal Pasta Cooked', 'grains', '200g', 248, 9.5, 47.0, 2.0, 4.5),
('Sweet Potato', 'grains', '200g', 172, 3.0, 40.0, 0.5, 4.5),
('White Potato', 'grains', '200g', 154, 4.0, 34.0, 0.5, 3.0),
('Quinoa Cooked', 'grains', '150g', 165, 6.0, 29.0, 3.0, 2.5),
('Couscous Cooked', 'grains', '150g', 176, 6.0, 36.0, 0.5, 1.5);

-- FRUIT (8)
INSERT INTO foods (name, category, serving_size, calories, protein_g, carbs_g, fat_g, fibre_g) VALUES
('Banana', 'fruit', '1 medium (120g)', 108, 1.5, 27.0, 0.5, 2.0),
('Apple', 'fruit', '1 medium (180g)', 95, 0.5, 24.0, 0.5, 3.5),
('Blueberries', 'fruit', '100g', 57, 0.5, 14.0, 0.5, 2.5),
('Strawberries', 'fruit', '100g', 32, 0.5, 8.0, 0.5, 2.0),
('Orange', 'fruit', '1 medium (150g)', 71, 1.5, 16.5, 0.5, 3.0),
('Grapes', 'fruit', '100g', 69, 0.5, 18.0, 0.5, 0.5),
('Mango', 'fruit', '100g', 65, 0.5, 17.0, 0.5, 1.5),
('Avocado', 'fruit', 'half (80g)', 128, 1.5, 2.0, 12.0, 3.5);

-- VEGETABLES (10)
INSERT INTO foods (name, category, serving_size, calories, protein_g, carbs_g, fat_g, fibre_g) VALUES
('Broccoli', 'vegetables', '100g', 34, 3.0, 5.0, 0.5, 2.5),
('Spinach', 'vegetables', '100g', 23, 3.0, 1.5, 0.5, 2.0),
('Green Beans', 'vegetables', '100g', 31, 2.0, 7.0, 0.5, 3.5),
('Peppers', 'vegetables', '100g', 31, 1.0, 7.0, 0.5, 1.5),
('Tomatoes', 'vegetables', '100g', 18, 1.0, 3.5, 0.5, 1.0),
('Carrots', 'vegetables', '100g', 41, 1.0, 10.0, 0.5, 3.0),
('Courgette', 'vegetables', '100g', 17, 1.5, 3.0, 0.5, 1.0),
('Mushrooms', 'vegetables', '100g', 22, 3.0, 3.0, 0.5, 1.0),
('Asparagus', 'vegetables', '100g', 20, 2.5, 3.5, 0.5, 2.0),
('Kale', 'vegetables', '100g', 49, 4.5, 9.0, 1.0, 3.5);

-- FATS (8)
INSERT INTO foods (name, category, serving_size, calories, protein_g, carbs_g, fat_g, fibre_g) VALUES
('Olive Oil', 'fats', '1 tbsp (15ml)', 135, 0.0, 0.0, 15.0, 0.0),
('Coconut Oil', 'fats', '1 tbsp (15ml)', 130, 0.0, 0.0, 14.5, 0.0),
('Peanut Butter', 'fats', '30g', 188, 8.0, 6.0, 16.0, 1.5),
('Almond Butter', 'fats', '30g', 180, 6.5, 6.0, 16.0, 1.5),
('Almonds', 'fats', '30g', 174, 6.0, 6.0, 15.0, 2.5),
('Walnuts', 'fats', '30g', 196, 4.5, 4.0, 19.5, 1.0),
('Chia Seeds', 'fats', '20g', 98, 3.5, 8.5, 6.0, 7.0),
('Flaxseed', 'fats', '15g', 80, 2.5, 4.0, 6.0, 4.0);

-- CARBS (6)
INSERT INTO foods (name, category, serving_size, calories, protein_g, carbs_g, fat_g, fibre_g) VALUES
('Bagel', 'carbs', '1 bagel (90g)', 245, 9.0, 48.0, 1.5, 2.0),
('Flour Wrap', 'carbs', '1 large (60g)', 180, 5.0, 33.0, 4.0, 1.5),
('Rice Cakes', 'carbs', '2 cakes (18g)', 71, 1.5, 15.5, 0.5, 0.5),
('Granola', 'carbs', '50g', 224, 4.5, 33.0, 9.0, 2.5),
('Honey', 'carbs', '1 tbsp (20g)', 61, 0.0, 16.5, 0.0, 0.0),
('Jam', 'carbs', '1 tbsp (20g)', 49, 0.0, 13.0, 0.0, 0.5);

-- SNACKS (8)
INSERT INTO foods (name, category, serving_size, calories, protein_g, carbs_g, fat_g, fibre_g) VALUES
('Protein Bar', 'snacks', '60g', 219, 21.0, 23.0, 5.5, 3.5),
('Dark Chocolate 70%', 'snacks', '30g', 170, 2.5, 12.0, 12.0, 2.5),
('Hummus', 'snacks', '50g', 93, 3.5, 9.0, 5.0, 2.0),
('Popcorn Plain', 'snacks', '30g', 118, 2.0, 24.0, 1.5, 3.5),
('Trail Mix', 'snacks', '40g', 196, 5.0, 17.0, 13.0, 2.0),
('Rice Pudding', 'snacks', '150g', 150, 3.5, 27.0, 3.5, 0.5),
('Cereal Bar', 'snacks', '30g', 120, 2.0, 22.0, 3.0, 1.0),
('Beef Jerky', 'snacks', '30g', 99, 15.0, 5.0, 2.5, 0.0);

-- DRINKS (6)
INSERT INTO foods (name, category, serving_size, calories, protein_g, carbs_g, fat_g, fibre_g) VALUES
('Black Coffee', 'drinks', '250ml', 5, 0.5, 0.5, 0.0, 0.0),
('Green Tea', 'drinks', '250ml', 3, 0.0, 0.5, 0.0, 0.0),
('Coconut Water', 'drinks', '250ml', 48, 1.5, 11.5, 0.5, 0.0),
('Orange Juice', 'drinks', '250ml', 113, 1.5, 26.0, 0.5, 0.5),
('Smoothie Basic', 'drinks', '300ml', 165, 5.0, 32.0, 2.5, 3.0),
('Electrolyte Drink', 'drinks', '500ml', 35, 0.0, 8.5, 0.0, 0.0);

-- SUPPLEMENTS (4)
INSERT INTO foods (name, category, serving_size, calories, protein_g, carbs_g, fat_g, fibre_g) VALUES
('Creatine Monohydrate', 'supplements', '5g', 0, 0.0, 0.0, 0.0, 0.0),
('BCAA Powder', 'supplements', '10g', 40, 7.0, 2.0, 0.5, 0.0),
('Pre-Workout', 'supplements', '1 scoop (15g)', 55, 2.0, 9.0, 0.5, 0.0),
('Multivitamin', 'supplements', '1 tablet', 5, 0.0, 1.0, 0.0, 0.0);

-- OTHER (8)
INSERT INTO foods (name, category, serving_size, calories, protein_g, carbs_g, fat_g, fibre_g) VALUES
('Tomato Sauce', 'other', '50g', 37, 1.0, 7.0, 0.5, 1.0),
('Soy Sauce', 'other', '15ml', 9, 1.5, 1.0, 0.0, 0.0),
('Hot Sauce', 'other', '10ml', 4, 0.0, 1.0, 0.0, 0.0),
('Balsamic Vinegar', 'other', '15ml', 26, 0.0, 6.0, 0.0, 0.0),
('Gravy', 'other', '50ml', 23, 0.5, 4.0, 0.5, 0.0),
('Stock Cube', 'other', '1 cube (10g)', 28, 1.0, 3.5, 1.0, 0.0),
('Mixed Herbs and Spices', 'other', '5g', 14, 0.5, 2.5, 0.5, 1.0),
('Coconut Milk', 'other', '100ml', 152, 1.5, 3.5, 15.5, 0.0);
