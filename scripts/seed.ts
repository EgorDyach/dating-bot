import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config as loadDotenv } from 'dotenv';
import { UserEntity } from '../src/database/entities/user.entity';
import { ProfileEntity } from '../src/database/entities/profile.entity';
import { ProfilePhotoEntity } from '../src/database/entities/profile-photo.entity';
import { UserPreferenceEntity } from '../src/database/entities/user-preference.entity';

loadDotenv();

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    UserEntity,
    ProfileEntity,
    ProfilePhotoEntity,
    UserPreferenceEntity,
  ],
  synchronize: false,
});

const FEMALE_USERS = [
  {
    telegramId: '100001',
    firstName: 'Александра',
    lastName: 'Смирнова',
    displayName: 'Саша',
    bio: 'Люблю путешествия и фотографию 📸',
    genderCode: 'female',
    city: 'Москва',
    birthDate: '1998-05-15',
    photos: [
      'https://plus.unsplash.com/premium_photo-1689551670902-19b441a6afde?q=80&w=1287&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    ],
  },
  {
    telegramId: '100002',
    firstName: 'Виктория',
    lastName: 'Петрова',
    displayName: 'Вика',
    bio: 'Йога, философия, путешествия ✨',
    genderCode: 'female',
    city: 'Санкт-Петербург',
    birthDate: '1996-03-22',
    photos: [
      'https://images.unsplash.com/photo-1524502397800-2eeaad7c3fe5?q=80&w=1287&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    ],
  },
  {
    telegramId: '100003',
    firstName: 'Елена',
    lastName: 'Волкова',
    displayName: 'Лена',
    bio: 'Дизайнер, люблю кино и музыку 🎬🎵',
    genderCode: 'female',
    city: 'Казань',
    birthDate: '1999-07-10',
    photos: [
      'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?q=80&w=1287&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    ],
  },
  {
    telegramId: '100004',
    firstName: 'Мария',
    lastName: 'Иванова',
    displayName: 'Маша',
    bio: 'Студентка, интересуюсь искусством 🎨',
    genderCode: 'female',
    city: 'Новосибирск',
    birthDate: '2000-11-30',
    photos: [
      'https://plus.unsplash.com/premium_photo-1668896122554-2a4456667f65?q=80&w=1287&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    ],
  },
  {
    telegramId: '100005',
    firstName: 'Дарья',
    lastName: 'Кузнецова',
    displayName: 'Даша',
    bio: 'Маркетолог, люблю кофе и книги ☕📚',
    genderCode: 'female',
    city: 'Екатеринбург',
    birthDate: '1997-02-14',
    photos: [
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=1287&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    ],
  },
];

const MALE_USERS = [
  {
    telegramId: '200001',
    firstName: 'Антон',
    lastName: 'Орлов',
    displayName: 'Антон',
    bio: 'Программист, люблю спорт и путешествия 💻🏃',
    genderCode: 'male',
    city: 'Москва',
    birthDate: '1995-08-20',
    photos: [
      'https://images.unsplash.com/photo-1618001789159-ffffe6f96ef2?q=80&w=1287&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    ],
  },
  {
    telegramId: '200002',
    firstName: 'Дмитрий',
    lastName: 'Сидоров',
    displayName: 'Дима',
    bio: 'Дизайнер, fotografer 📸🎨',
    genderCode: 'male',
    city: 'Санкт-Петербург',
    birthDate: '1994-04-10',
    photos: [
      'https://images.unsplash.com/photo-1705944909428-c1f2178bae24?q=80&w=2340&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    ],
  },
  {
    telegramId: '200003',
    firstName: 'Сергей',
    lastName: 'Морозов',
    displayName: 'Сергей',
    bio: 'Предприниматель, люблю путешествия ✈️',
    genderCode: 'male',
    city: 'Казань',
    birthDate: '1993-12-25',
    photos: [
      'https://images.unsplash.com/photo-1705944910791-887c4ed535c8?q=80&w=1287&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    ],
  },
  {
    telegramId: '200004',
    firstName: 'Максим',
    lastName: 'Федоров',
    displayName: 'Макс',
    bio: 'Фитнес тренер, здоровый образ жизни 💪',
    genderCode: 'male',
    city: 'Новосибирск',
    birthDate: '1998-06-05',
    photos: [
      'https://plus.unsplash.com/premium_photo-1732117940281-e1598445016c?q=80&w=1287&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    ],
  },
  {
    telegramId: '200005',
    firstName: 'Владимир',
    lastName: 'Новиков',
    displayName: 'Влад',
    bio: 'Музыкант, путешественник 🎸🌍',
    genderCode: 'male',
    city: 'Екатеринбург',
    birthDate: '1996-09-18',
    photos: [
      'https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?q=80&w=1287&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    ],
  },
];

async function seedDatabase() {
  try {
    await AppDataSource.initialize();
    console.log('Database connected');

    // Clear existing data
    await AppDataSource.query('TRUNCATE TABLE profile_photos CASCADE');
    await AppDataSource.query('TRUNCATE TABLE profiles CASCADE');
    await AppDataSource.query('TRUNCATE TABLE users CASCADE');

    console.log('Tables cleared');

    const userRepo = AppDataSource.getRepository(UserEntity);
    const profileRepo = AppDataSource.getRepository(ProfileEntity);
    const photoRepo = AppDataSource.getRepository(ProfilePhotoEntity);

    // Seed female users
    for (const femaleData of FEMALE_USERS) {
      const user = userRepo.create({
        telegramId: femaleData.telegramId,
        firstName: femaleData.firstName,
        lastName: femaleData.lastName,
        username: femaleData.displayName.toLowerCase(),
      });

      const savedUser = await userRepo.save(user);

      const profile = profileRepo.create({
        userId: savedUser.id,
        displayName: femaleData.displayName,
        bio: femaleData.bio,
        genderCode: femaleData.genderCode,
        city: femaleData.city,
        birthDate: femaleData.birthDate,
        isActive: true,
        isVisibleInFeed: true,
        profileCompleteness: 100,
      });

      const savedProfile = await profileRepo.save(profile);

      // Save photos
      for (let i = 0; i < femaleData.photos.length; i++) {
        const photo = photoRepo.create({
          profileId: savedProfile.id,
          storageKey: femaleData.photos[i], // Store full URL as key
          contentType: 'image/jpeg',
          sortOrder: i,
        });
        await photoRepo.save(photo);
      }

      console.log(`Created female user: ${femaleData.displayName}`);
    }

    // Seed male users
    for (const maleData of MALE_USERS) {
      const user = userRepo.create({
        telegramId: maleData.telegramId,
        firstName: maleData.firstName,
        lastName: maleData.lastName,
        username: maleData.displayName.toLowerCase(),
      });

      const savedUser = await userRepo.save(user);

      const profile = profileRepo.create({
        userId: savedUser.id,
        displayName: maleData.displayName,
        bio: maleData.bio,
        genderCode: maleData.genderCode,
        city: maleData.city,
        birthDate: maleData.birthDate,
        isActive: true,
        isVisibleInFeed: true,
        profileCompleteness: 100,
      });

      const savedProfile = await profileRepo.save(profile);

      // Save photos
      for (let i = 0; i < maleData.photos.length; i++) {
        const photo = photoRepo.create({
          profileId: savedProfile.id,
          storageKey: maleData.photos[i], // Store full URL as key
          contentType: 'image/jpeg',
          sortOrder: i,
        });
        await photoRepo.save(photo);
      }

      console.log(`Created male user: ${maleData.displayName}`);
    }

    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
