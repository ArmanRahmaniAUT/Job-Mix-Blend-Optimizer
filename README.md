# Job-Mix-Blend-Optimizer
Aggregate Blending Optimization using Least Squares &amp; Penalty Methods. A script to determine optimal material ratios for construction sub-base and base layers, ensuring compliance with specified gradation limits.
Aggregate Job Mix Gradation Analysis App
 
  An interactive, Python-powered web application designed for civil and pavement engineers to calculate, visualize, and optimize aggregate blending ratios. By utilizing Least Squares Error minimization combined with Soft-Constraint Penalty Methods, the application automates the complex process of finding the mathematically ideal weight distribution among multiple aggregate sources to strictly satisfy project gradation envelopes.

---------------------------------------------------------------

Key Features:
 
  Standard & Custom Specification Envelopes
  
    Built-in database containing regulatory standard road layer classifications (Sub-base, Base course, and Gravel Surface).  
  
    Dynamic Linear Interpolation: Automatically maps and estimates required min/max passing thresholds for localized or custom sieve requirements (such as $12.5mm or #80 sieves) when exact matches are missing in the raw regulatory tables.  
   
    Toggle option to switch between pre-set standard rules and custom target inputs.  
 
  
  Multi-Source Aggregate 
   
    Add and configure up to 6 distinct aggregate stockpiles (e.g., Coarse Aggregate, Fine Sand, Quarry Dust) with custom gradation curves.  
 
  Mathematical Optimization Engine
  
    Driven by SciPy’s Sequential Least Squares Programming (SLSQP) algorithm.  
    
    Minimizes the overall variance from the midpoints of target specifications while incorporating a weighted penalty loop to actively force compliance within strict boundaries.  
   
    Enforces strict physical constraints (proportions must dynamically scale and sum to exactly 100%).  
 
  Interactive Gradation Workbench
   
    Live Sieve Gradation Curve Chart: Displays a visualization tracking the Optimized/Blended Curve, the Target Midpoint, individual Aggregate Components, and the shaded Specification Envelope.
    Manual Override Sliders: Fine-tune or manually override proportions using real-time sliders to test operational limits or accommodate on-site batching variances.

  Sieve Sizing Compliance Sheet
  
    An analytics grid providing direct visibility into the final blended performance, calculation deviations, and explicit compliance tracking (Conforming, Over spec, or Under spec) with detailed percentage offsets.  

---------------------------------------------------------------

How the Optimization Work
  1. Distance Minimization (Least Squares): The algorithm attempts to minimize the distance between the final composite blend and the ideal target midpoint for all sieve sizes simultaneously.
  2. Boundary Enforcement (Penalty Loop): If a calculated blend ventures outside the minimum or maximum allowed specification boundaries, a heavy penalty weight (w = 1000) is injected into the objective function to aggressively force the optimization matrix back into the acceptable envelope zone:

---------------------------------------------------------------

Step-by-Step Workflow:

  1. Select Your Target Spec: Choose your Road Layer Class and Mix Type (e.g., Aggregate Base Course - Type IV). The application will instantly fetch and interpolate the required ranges.  
  2. Input Source Data: If you wish to use custom values, enter the percent passing values for each available aggregate stockpile material.  
  3. Optimize: Click "Optimize Aggregate Mix" to run the penalty-driven solver. The workbench sliders will immediately snap to the mathematically optimal ratios, and the compliance sheet will  update to report any remaining out-of-range deviations.  
  4. Fine-Tune manually: Use the proportion sliders to intentionally drift from the mathematical ideal to observe how real-world field adjustments affect gradation compliance.
  5. Print: showcase your results in a comprehensive readible page.
