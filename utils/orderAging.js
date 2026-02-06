const calculateOrderAging = (statusChangedAt, thresholds) => {
  const now = new Date();
  const statusTime = new Date(statusChangedAt);
  const minutesElapsed = Math.floor((now - statusTime) / (1000 * 60));
  
  if (minutesElapsed >= thresholds.critical_minutes) return 'critical';
  if (minutesElapsed >= thresholds.warning_minutes) return 'warning';
  return 'fresh';
};

const getMinutesElapsed = (statusChangedAt) => {
  const now = new Date();
  const statusTime = new Date(statusChangedAt);
  return Math.floor((now - statusTime) / (1000 * 60));
};

const updateOrderAging = async (db, tenantId) => {
  return new Promise((resolve, reject) => {
    // Get aging thresholds for tenant
    db.get(`
      SELECT warning_minutes, critical_minutes 
      FROM aging_thresholds 
      WHERE tenant_id = ? AND is_active = 1
    `, [tenantId], (err, thresholds) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!thresholds) {
        // Use default thresholds
        thresholds = { warning_minutes: 5, critical_minutes: 20 };
      }
      
      // Update all active orders for this tenant
      db.run(`
        UPDATE orders 
        SET aging_level = CASE 
          WHEN (julianday('now') - julianday(status_changed_at)) * 24 * 60 >= ? THEN 'critical'
          WHEN (julianday('now') - julianday(status_changed_at)) * 24 * 60 >= ? THEN 'warning'
          ELSE 'fresh'
        END
        WHERE tenant_id = ? 
        AND status IN ('pending', 'confirmed', 'cooking', 'ready')
      `, [thresholds.critical_minutes, thresholds.warning_minutes, tenantId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
};

module.exports = {
  calculateOrderAging,
  getMinutesElapsed,
  updateOrderAging
};