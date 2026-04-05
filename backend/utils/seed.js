const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config(); // This looks in the current working directory (backend)

const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Category = require('../models/Category');
const Product = require('../models/Product');

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Clean up
  await Promise.all([
    User.deleteMany({}), Vendor.deleteMany({}),
    Category.deleteMany({}), Product.deleteMany({}),
  ]);
  console.log('Cleared existing data');

  // ── Users ──────────────────────────────────────────────────────────────────
  const admin = await User.create({
    name: 'Admin User', email: 'admin@anon.com',
    password: 'admin123', role: 'admin',
  });

  const vendorUser1 = await User.create({
    name: 'TechHub Store', email: 'vendor1@anon.com',
    password: 'vendor123', role: 'vendor',
  });
  const vendorUser2 = await User.create({
    name: 'Fashion World', email: 'vendor2@anon.com',
    password: 'vendor123', role: 'vendor',
  });
  const buyer = await User.create({
    name: 'John Buyer', email: 'buyer@anon.com',
    password: 'buyer123', role: 'buyer',
  });

    const delivery = await User.create({
    name: 'delivery', email: 'delivery@anon.com',
    password: 'delivery123', role: 'delivery',
  });

  // ── Vendors ────────────────────────────────────────────────────────────────
  const vendor1 = await Vendor.create({
    user: vendorUser1._id, storeName: 'TechHub Store',
    description: 'Your one-stop shop for the latest electronics and gadgets.',
    contactEmail: 'vendor1@anon.com', status: 'approved',
    logo: 'https://placehold.co/200x200/1a73e8/white?text=TH',
    banner: 'https://placehold.co/1200x300/1a73e8/white?text=TechHub',
  });

  const vendor2 = await Vendor.create({
    user: vendorUser2._id, storeName: 'Fashion World',
    description: 'Trendy clothing and accessories for every occasion.',
    contactEmail: 'vendor2@anon.com', status: 'approved',
    logo: 'https://placehold.co/200x200/e91e63/white?text=FW',
    banner: 'https://placehold.co/1200x300/e91e63/white?text=FashionWorld',
  });

  // ── Categories ─────────────────────────────────────────────────────────────
  const electronics = await Category.create({ name: 'Electronics', order: 1 });
  const fashion = await Category.create({ name: 'Fashion', order: 2 });
  const jewellery = await Category.create({ name: 'Jewellery', order: 3 });
  const cosmetics = await Category.create({ name: 'Cosmetics', order: 4 });
  const footwear = await Category.create({ name: 'Footwear', order: 5 });

  const subLaptops = await Category.create({ name: 'Laptops', parent: electronics._id });
  const subPhones = await Category.create({ name: 'Phones', parent: electronics._id });
  const subMens = await Category.create({ name: "Men's", parent: fashion._id });
  const subWomens = await Category.create({ name: "Women's", parent: fashion._id });

  // ── Products ───────────────────────────────────────────────────────────────
  const products = [
    {
      vendor: vendor1._id, category: subLaptops._id,
      name: 'ProBook Ultra 15', price: 1299.99, comparePrice: 1499.99,
      description: 'Powerful laptop with 12th Gen Intel Core i7, 16GB RAM, 512GB SSD.',
      shortDescription: 'High-performance laptop for professionals.',
      stock: 25, isFeatured: true,
      images: ['https://placehold.co/600x600/1a73e8/white?text=Laptop'],
      thumbnail: 'https://placehold.co/600x600/1a73e8/white?text=Laptop',
      tags: ['laptop', 'electronics', 'intel'],
    },
    {
      vendor: vendor1._id, category: subPhones._id,
      name: 'Galaxy Nova Pro', price: 899.99, comparePrice: 999.99,
      description: 'Flagship smartphone with 6.7" AMOLED display, 108MP camera, 5G.',
      shortDescription: 'Next-gen flagship smartphone.',
      stock: 40, isFeatured: true,
      images: ['https://placehold.co/600x600/34a853/white?text=Phone'],
      thumbnail: 'https://placehold.co/600x600/34a853/white?text=Phone',
      tags: ['phone', 'smartphone', '5g'],
    },
    {
      vendor: vendor1._id, category: electronics._id,
      name: 'SoundPro Wireless Headphones', price: 149.99, comparePrice: 199.99,
      description: 'Premium noise-cancelling wireless headphones with 30hr battery.',
      shortDescription: 'Premium ANC headphones.',
      stock: 60,
      images: ['https://placehold.co/600x600/ff6d00/white?text=Headphones'],
      thumbnail: 'https://placehold.co/600x600/ff6d00/white?text=Headphones',
      tags: ['headphones', 'audio', 'wireless'],
    },
    {
      vendor: vendor2._id, category: subMens._id,
      name: 'Classic Oxford Shirt', price: 49.99, comparePrice: 79.99,
      description: 'Premium cotton Oxford shirt, perfect for formal and casual wear.',
      shortDescription: 'Timeless men\'s Oxford shirt.',
      stock: 100, isFeatured: true,
      images: ['https://placehold.co/600x600/e91e63/white?text=Shirt'],
      thumbnail: 'https://placehold.co/600x600/e91e63/white?text=Shirt',
      tags: ['shirt', 'mens', 'formal'],
    },
    {
      vendor: vendor2._id, category: subWomens._id,
      name: 'Floral Maxi Dress', price: 69.99, comparePrice: 99.99,
      description: 'Elegant floral maxi dress, perfect for summer occasions.',
      shortDescription: 'Beautiful floral summer dress.',
      stock: 50, isFeatured: true,
      images: ['https://placehold.co/600x600/9c27b0/white?text=Dress'],
      thumbnail: 'https://placehold.co/600x600/9c27b0/white?text=Dress',
      tags: ['dress', 'womens', 'summer'],
    },
    {
      vendor: vendor2._id, category: jewellery._id,
      name: 'Rose Gold Earrings', price: 29.99, comparePrice: 49.99,
      description: 'Delicate rose gold drop earrings, perfect for any occasion.',
      shortDescription: 'Elegant rose gold earrings.',
      stock: 80,
      images: ['https://placehold.co/600x600/f44336/white?text=Earrings'],
      thumbnail: 'https://placehold.co/600x600/f44336/white?text=Earrings',
      tags: ['jewellery', 'earrings', 'rose gold'],
    },
  ];

  for (const p of products) {
    await Product.create(p);
  }

  console.log('✅ Seed complete!');
  console.log('\n── Credentials ──────────────────────────');
  console.log('Admin:   admin@anon.com   / admin123');
  console.log('Vendor1: vendor1@anon.com / vendor123');
  console.log('Vendor2: vendor2@anon.com / vendor123');
  console.log('Buyer:   buyer@anon.com   / buyer123');
  console.log('─────────────────────────────────────────');
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });
