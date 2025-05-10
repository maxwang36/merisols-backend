// backend/middleware/checkAdminRole.js
const supabase = require('../lib/supabase'); // Adjust path as needed

const checkAdminRole = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }
  const token = authHeader.split(' ')[1];

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    console.error("Auth Error in admin middleware:", authError?.message);
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }

  const { data: userData, error: dbError } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .single();

  if (dbError) {
     console.error("DB Error fetching user role in admin middleware:", dbError?.message);
     return res.status(500).json({ message: 'Forbidden: Could not verify user profile' });
  }
   if (!userData) {
       console.warn(`Forbidden: User profile not found for auth_id: ${user.id}`);
       return res.status(403).json({ message: 'Forbidden: User profile not found' });
   }

  if (userData.role !== 'admin') {
    console.warn(`Forbidden: User ${user.id} has role '${userData.role}', required 'admin'`);
    return res.status(403).json({ message: `Forbidden: Requires admin role` });
  }

  req.user = { ...user, ...userData }; // Attach user info and their role from your 'users' table
  console.log(`Admin access granted for user_id: ${user.id}, role: ${userData.role}`);
  next();
};

module.exports = checkAdminRole;
