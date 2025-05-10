// backend/routes/settings.js
const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const checkAdminRole = require('../middleware/checkAdminRole'); // Import the middleware

const SETTINGS_ROW_ID = 1; // ID of the single row in site_settings

// GET current site settings (including maintenance mode)
// This endpoint can be public if needed, or protected if only admins should see it.
// For now, making it public to allow frontend to easily check status.
router.get('/status', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('maintenance_mode, updated_at')
      .eq('id', SETTINGS_ROW_ID)
      .single();

    if (error) {
        // If the error is that the row doesn't exist, it means settings haven't been initialized.
        // This shouldn't happen if the SQL script for insertion was run.
        if (error.code === 'PGRST116') { // PostgREST error for " exactamente um linha esperada, mas 0 linhas encontradas" (exactly one row expected, but 0 rows found)
            console.warn('Site settings not found, returning default (maintenance_mode: false)');
            return res.json({ maintenance_mode: false, updated_at: null });
        }
        throw error;
    }
    
    if (!data) { // Should be caught by .single() and PGRST116, but as a fallback
        console.warn('Site settings data is null, returning default (maintenance_mode: false)');
        return res.json({ maintenance_mode: false, updated_at: null });
    }

    res.json({ 
        maintenance_mode: data.maintenance_mode,
        updated_at: data.updated_at 
    });
  } catch (err) {
    console.error('Error fetching site settings:', err.message);
    res.status(500).json({ message: 'Failed to fetch site settings', error: err.message });
  }
});

// PUT to update maintenance mode status (Admin only)
router.put('/status', checkAdminRole, async (req, res) => {
  const { maintenance_mode } = req.body;

  if (typeof maintenance_mode !== 'boolean') {
    return res.status(400).json({ message: 'Invalid maintenance_mode value. Must be true or false.' });
  }

  try {
    const { data, error } = await supabase
      .from('site_settings')
      .update({ 
        maintenance_mode: maintenance_mode,
        // updated_at will be handled by the trigger
      })
      .eq('id', SETTINGS_ROW_ID)
      .select()
      .single(); // Expecting a single row to be updated and returned

    if (error) throw error;
    
    if (!data) {
        // This case implies the settings row (id=1) didn't exist to be updated.
        // This should ideally not happen if the initial SQL setup was correct.
        console.error('Failed to update site settings: settings row not found.');
        return res.status(404).json({ message: 'Site settings not found. Initialization might be needed.' });
    }

    res.json({ 
        message: 'Maintenance mode updated successfully.', 
        maintenance_mode: data.maintenance_mode,
        updated_at: data.updated_at
    });
  } catch (err) {
    console.error('Error updating maintenance mode:', err.message);
    res.status(500).json({ message: 'Failed to update maintenance mode', error: err.message });
  }
});

module.exports = router;
