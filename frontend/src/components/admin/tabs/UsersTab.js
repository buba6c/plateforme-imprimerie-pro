import React from 'react';
import UserManagement from '../UserManagement';

const UsersTab = ({ user, onNavigate }) => {
  return (
    <div>
      <UserManagement user={user} />
    </div>
  );
};

export default UsersTab;
