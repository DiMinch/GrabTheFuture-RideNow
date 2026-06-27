import { getDb } from '../config/firebase.js';

async function seed() {
  console.log('Seeding mock drivers to Firestore...');
  try {
    const db = getDb();
    
    const mockDrivers = [
      {
        name: 'Nguyen Van Binh',
        plate: '59P1-99999',
        ble_major_minor: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0:1:101',
        latitude: 10.8756, // Gần ĐHQG TP.HCM / Khu vực thử nghiệm
        longitude: 106.8007,
        busy: false,
        accessibilityFriendly: true,
        rating: 4.9,
        updatedAt: new Date()
      },
      {
        name: 'Tran Van An',
        plate: '59A2-88888',
        ble_major_minor: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0:1:102',
        latitude: 10.8790,
        longitude: 106.8030,
        busy: false,
        accessibilityFriendly: false,
        rating: 4.7,
        updatedAt: new Date()
      },
      {
        name: 'Le Thi Hoa',
        plate: '59C1-77777',
        ble_major_minor: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0:1:103',
        latitude: 10.8700,
        longitude: 106.7980,
        busy: true, // Tài xế đang bận
        accessibilityFriendly: true,
        rating: 4.8,
        updatedAt: new Date()
      }
    ];

    for (const [index, driver] of mockDrivers.entries()) {
      const id = `driver-mock-${index + 1}`;
      await db.collection('drivers').doc(id).set(driver);
      console.log(`- Seeded driver: ${driver.name} (ID: ${id})`);
    }
    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
