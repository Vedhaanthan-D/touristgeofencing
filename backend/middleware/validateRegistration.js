const { z } = require('zod');

const aadhaarRegex = /^\d{12}$/;
const passportRegex = /^[A-Z0-9]{6,9}$/i;
const nameRegex = /^[a-zA-Z\s]{2,100}$/;
const phoneRegex = /^\d{10}$/;
const emergencyPhoneRegex = /^\+?\d{7,15}$/;

const registrationSchema = z.object({
    aadhaar: z.string().refine(
        (val) => aadhaarRegex.test(val) || passportRegex.test(val),
        { message: 'Must be a valid 12-digit Aadhaar or 6-9 character Passport ID' }
    ),
    fullName: z.string().trim().refine(
        (val) => nameRegex.test(val),
        { message: 'Full name must contain only letters and be at least 2 characters long' }
    ),
    age: z.union([z.number(), z.string().transform(v => Number(v))]).pipe(z.number().int().min(1).max(120)),
    gender: z.enum(['Male', 'Female', 'Other']),
    email: z.string().email({ message: 'Invalid email address format' }),
    mobileNumber: z.string().refine(
        (val) => phoneRegex.test(val),
        { message: 'Mobile number must be exactly 10 digits' }
    ),
    tripDetails: z.object({
        destination: z.string().trim().min(2, { message: 'Destination must be at least 2 characters' }),
        returnDate: z.string().refine(
            (val) => {
                const date = new Date(val);
                return !isNaN(date.getTime()) && date > new Date();
            },
            { message: 'Return date must be a valid future date' }
        )
    }),
    familyMembers: z.array(
        z.object({
            fullName: z.string().trim().min(2, { message: 'Companion name must be at least 2 characters' }),
            age: z.union([z.number(), z.string().transform(v => Number(v))]).pipe(z.number().int().min(1).max(120)),
            gender: z.enum(['Male', 'Female', 'Other'])
        })
    ).optional().default([]),
    emergencyContacts: z.array(
        z.object({
            name: z.string().trim().min(1, { message: 'Emergency contact name is required' }),
            phone: z.string().refine(
                (val) => emergencyPhoneRegex.test(val.replace(/\s/g, '')),
                { message: 'Invalid emergency contact phone number format' }
            )
        })
    ).min(1, { message: 'At least one emergency contact is required' })
});

/** Express middleware validating registration request payloads against Zod schema rules. */
const validateRegistration = (req, res, next) => {
    const result = registrationSchema.safeParse(req.body);
    if (!result.success) {
        const errorMessages = result.error.errors.map(err => err.message).join('; ');
        return res.status(400).json({ error: `Validation error: ${errorMessages}` });
    }
    req.body = result.data;
    next();
};

module.exports = validateRegistration;
