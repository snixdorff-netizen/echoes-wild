using UnityEngine;
using System.Collections.Generic;

/// <summary>
/// GuildManager + StoryManager combined stub (social + narrative layer).
/// Supports the viral "share report" and co-op / community events requested in the series design.
/// </summary>
public class GuildManager : MonoBehaviour
{
    public static GuildManager Instance;

    public List<string> guildFeed = new List<string>();

    void Awake() { Instance = this; }

    public void PostToGuild(string report, float accuracy)
    {
        guildFeed.Insert(0, report);
        if (guildFeed.Count > 12) guildFeed.RemoveAt(guildFeed.Count - 1);

        // In production: Firebase or your backend. Trigger notifications for friends.
        Debug.Log("[Guild] New post from " + (GameManager.Instance ? GameManager.Instance.currentPersona : "Researcher") + ": " + report);
    }

    // Story beats driven by acoustic health / accuracy milestones
    public void AdvanceStoryIfNeeded(float health)
    {
        if (health > 90) Debug.Log("[Story] New chapter: 'The Silent Zone recovers — your data helped secure the grant.'");
    }
}
