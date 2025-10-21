/**
 * 🚚 LivreurBoard - Utilise la nouvelle Interface Livreur V2
 * Interface moderne avec tous les nouveaux composants
 */

import React from 'react';
import LivreurInterfaceV2 from '../LivreurInterfaceV2';

const LivreurBoard = ({ user, initialSection = 'a_livrer' }) => {
  return (
    <LivreurInterfaceV2 
      user={user} 
      initialSection={initialSection}
    />
  );
};

export default LivreurBoard;
