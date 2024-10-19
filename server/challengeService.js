const Challenge = require('./schema/Challenge');
const User = require('./schema/User');

const updateChallenge = async (challengeId, data) => {
  try {
    // Find the challenge by challengeId and update it
    const updatedChallenge = await Challenge.findOneAndUpdate(
      { challengeId: challengeId },
      {
        $set: {
          challengeName: data.challengeName,
          challengeType: data.challengeType,
          challengeDescription: data.challengeDescription,
          startDateTime: data.startDateTime,
          endDateTime: data.endDateTime,
          goalAmount: data.goalAmount,
          challengeTags: data.challengeTags
        }
      },
      { new: true, runValidators: true }
    );

    if (!updatedChallenge) {
      throw new Error(`Challenge with id ${challengeId} not found`);
    }

    console.log(`Challenge ${challengeId} updated successfully`);

    // If challengeTags have changed, we might need to update user assignments
    if (data.challengeTags) {
      // This is a simplified version. You might want to implement more sophisticated logic
      // to only update user assignments if the tags have actually changed.
      await updateUserAssignments(updatedChallenge);
    }

    return updatedChallenge;
  } catch (error) {
    console.error('Error in updateChallenge:', error);
    throw error;
  }
};

// Helper function to update user assignments
const updateUserAssignments = async (challenge) => {
  try {
    // Remove the challenge from all users who were previously assigned
    await User.updateMany(
      { 'assignedChallenges.challengeId': challenge._id },
      { $pull: { assignedChallenges: { challengeId: challenge._id } } }
    );

    // Find and assign users based on new tags
    const assignedUsers = await assignUsersToChallenge(challenge);

    console.log(`Updated challenge assignment: ${assignedUsers} users in total`);
  } catch (error) {
    console.error('Error updating user assignments:', error);
    throw error;
  }
};

// Helper function to assign users to a challenge
const assignUsersToChallenge = async (challenge) => {
  let assignedUsers = 0;

  for (const teamTags of challenge.challengeTags) {
    const users = await User.find({
      tags: { $elemMatch: { $all: teamTags } }
    });

    await User.updateMany(
      { _id: { $in: users.map(user => user._id) } },
      {
        $push: {
          assignedChallenges: {
            challengeId: challenge._id,
            assignedTags: teamTags
          }
        }
      }
    );

    assignedUsers += users.length;
  }

  return assignedUsers;
};

module.exports = { updateChallenge };