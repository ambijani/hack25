const mongoose = require('mongoose');
const User = require('./schemas/User');
const Challenge = require('./schemas/Challenge');
const Team = require('./schemas/Team');

const generateUsername = email => email.split('@')[0];

const range = (start, end) => Array.from({ length: end - start + 1 }, (_, i) => (start + i).toString());

const getAllTags = () => {
  const yearOf = range(2020, 2025);
  const major = [
    'Computer Eng.',
    'Computer Sci.',
    'Software Eng.',
    'Electrical Eng.',
    'Mechanical Eng.',
    'Civil Eng.',
    'Biomedical Eng.',
    'Data Science',
    'Information Technology',
    'Physics',
    'Mathematics'
  ];
  const housing = [
    'Bear Beginnings',
    'Umrath House',
    'Liggett House',
    'Rubelmann Hall',
    'Eliot House',
    'Shanedling House',
    'Dardick House',
    'Thomas H. Eliot Residential College',
    'Park/Mudd Residential College',
    'Koenig Residential College',
    'South 40 House',
    'The Village',
    'Millbrook Apartments',
    'Lofts Apartments',
    'off campus'
  ];
  const clubs = ['ACM', 'DBF', 'MSA', 'IEEE', 'WU Racing'];
  return { yearOf, major, housing, clubs };
};

const assignChallengesToNewUser = async (email) => {
  let session;
  try {
    console.log('Starting assignChallengesToNewUser for email:', email);
    console.log('User model available:', !!User);

    session = await mongoose.startSession();
    session.startTransaction();
    console.log(email);
    // Fetch the user by email
    const user = await User.findOne({ email }).session(session);
    console.log('User found:', !!user);
    if (!user) {
      throw new Error('User not found');
    }

    // Fetch all active challenges
    const currentDate = new Date();
    console.log('Fetching active challenges...');
    const activeChallenges = await Challenge.find({
      startDateTime: { $lte: currentDate },
      endDateTime: { $gte: currentDate }
    }).session(session);
    console.log('Active challenges found:', activeChallenges.length);
    console.log('!!Active challenge detail:', activeChallenges);
    
    // Array to store challenges to be assigned
    const challengesToAssign = [];
    const teamUpdates = [];
    const challengeUpdates = [];

    // Check each challenge against user tags
    for (const challenge of activeChallenges) {
      for (const challengeTagSet of challenge.challengeTags) {
        // Check if any of the user's tag sets fully match this challenge tag set
        const matchFound = user.tags.some(userTagSet =>
          challengeTagSet.every(tag => userTagSet.includes(tag))
        );

        if (matchFound) {
          challengesToAssign.push({
            challengeId: challenge._id,
            assignedTags: challengeTagSet,
            score: 0
          });

          // Prepare team update
          teamUpdates.push({
            updateOne: {
              filter: { teamTags: challengeTagSet },
              update: { $addToSet: { challenges: { challengeId: challenge._id, score: 0 } } },
              upsert: true
            }
          });

          // Prepare challenge update
          challengeUpdates.push({
            updateOne: {
              filter: { _id: challenge._id },  // Changed from *id to _id
              update: {
                $addToSet: {
                  'leaderboard.users': { userId: user._id, email: user.email, score: 0 },
                  'leaderboard.teams': { teamTags: challengeTagSet, score: 0 }
                }
              }
            }
          });

          break; // Move to next challenge once a match is found
        }
      }
    }

    // Perform bulk operations
    if (challengesToAssign.length > 0) {
      await User.findOneAndUpdate(
        { email },
        { $push: { assignedChallenges: { $each: challengesToAssign } } },
        { session }
      );

      if (teamUpdates.length > 0) {
        await Team.bulkWrite(teamUpdates, { session });
      }

      if (challengeUpdates.length > 0) {
        await Challenge.bulkWrite(challengeUpdates, { session });
      }
    }

    await session.commitTransaction();
    console.log(`Assigned ${challengesToAssign.length} challenges to user ${email}`);
    return challengesToAssign;
  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }
    console.error('Error in assignChallengesToNewUser:', error);
    throw error;
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

module.exports = { generateUsername, assignChallengesToNewUser, getAllTags };