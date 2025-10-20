import React, { useEffect, useState, useRef } from "react";
import { API_URLS } from "../config/api";

const BIO_WORD_LIMIT = 20;

export default function UserProfile() {
  // Animation helper (same as ScoresList)
  const fadeSlideInStyle = (delay) => ({
    animationName: "fadeSlideIn",
    animationDuration: "0.7s",
    animationTimingFunction: "ease-out",
    animationFillMode: "forwards",
    animationDelay: delay,
    opacity: 0,
    transform: "translateY(1rem)",
  });

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    bio: "",
    skills: "",
    imageUrl: "",
    imageFile: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [editMode, setEditMode] = useState(false);

  const token = localStorage.getItem("token");
  const bioWordCount =
    profile.bio.trim() === "" ? 0 : profile.bio.trim().split(/\s+/).length;

  useEffect(() => {
    if (!token) {
      setError("User not logged in");
      setLoading(false);
      return;
    }

    async function fetchProfile() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(API_URLS.PROFILE, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load profile");
        const data = await res.json();

        setProfile({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          bio: data.bio || "",
          skills: Array.isArray(data.skills)
            ? data.skills.join(", ")
            : data.skills || "",
          imageUrl: data.imageUrl || "",
          imageFile: null,
        });
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "bio") {
      const words = value.trim().split(/\s+/);
      if (words.length > BIO_WORD_LIMIT) return;
    }
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectImage = (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Max allowed size is 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setProfile((prev) => ({
        ...prev,
        imageUrl: ev.target.result,
        imageFile: file,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setError(null);
    setSuccessMsg(null);

    if (bioWordCount > BIO_WORD_LIMIT) {
      setError(`Bio cannot exceed ${BIO_WORD_LIMIT} words.`);
      return;
    }

    if (!token) {
      setError("User not logged in");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: profile.name.trim(),
        phone: profile.phone.trim(),
        bio: profile.bio.trim(),
        skills: profile.skills
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean),
        imageUrl: profile.imageUrl,
      };

      const res = await fetch(API_URLS.PROFILE, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to update profile");
      }

      setSuccessMsg("Profile updated successfully!");
      setEditMode(false);
      setProfile((prev) => ({ ...prev, imageFile: null }));
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="text-center py-8 text-green-500">Loading profile...</div>
    );
  if (error)
    return (
      <div className="text-center py-8 text-red-600">Error: {error}</div>
    );

  // Profile Picture Sub-component
  function ProfilePictureCard({ profileImage, onSelectImage }) {
    const fileInputRef = useRef(null);
    const [preview, setPreview] = useState(profileImage || "");

    useEffect(() => {
      setPreview(profileImage);
    }, [profileImage]);

    const handleImageChange = (e) => {
      const file = e.target.files[0];
      if (file && file.size <= 2 * 1024 * 1024) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setPreview(ev.target.result);
          if (onSelectImage) onSelectImage(file);
        };
        reader.readAsDataURL(file);
      } else {
        alert("Max allowed size is 2MB.");
      }
    };

    return (
      <div
        style={fadeSlideInStyle("0.1s")}
        className="rounded-lg shadow-md p-4 border border-[#2D3748] bg-[#222B3A] text-white"
      >
        <div className="mb-3">
          <h2 className="text-xl font-semibold">Profile Picture</h2>
          <span className="text-sm text-gray-400">Update your profile photo</span>
        </div>
        <div className="flex items-center mt-3 gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-[#ecf1f7] flex items-center justify-center overflow-hidden ring-2 ring-[#364154]">
              {preview ? (
                <img
                  src={preview}
                  alt="Profile Preview"
                  className="object-cover w-full h-full"
                />
              ) : (
                <span className="text-[#c1c9d6] text-2xl">👤</span>
              )}
            </div>
            <button
              type="button"
              aria-label="Change photo"
              className="absolute -bottom-1 -left-1 bg-green-600 text-white rounded-full border-4 border-[#222B3A] p-1 hover:bg-green-700 transition"
              onClick={() => fileInputRef.current.click()}
            >
              📷
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/gif"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImageChange}
              />
            </button>
          </div>

          <div>
            <button
              className="mb-2 px-4 py-2 bg-[#1f2937] text-white border border-[#334155] rounded-md text-sm font-medium hover:bg-green-600 hover:border-green-700 transition"
              type="button"
              onClick={() => fileInputRef.current.click()}
            >
              Change Photo
            </button>
            <div className="text-xs text-gray-400">
              JPG, PNG or GIF. Max size 2MB.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 min-h-screen">
      <style>{`
        @keyframes fadeSlideIn {
          0% { opacity: 0; transform: translateY(1rem); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

     {successMsg && (
  <div
    style={fadeSlideInStyle("0.05s")}
    className="mb-4 flex items-center justify-between p-4 rounded-lg bg-green-600 text-white shadow relative"
  >
    <span className="font-semibold">{successMsg}</span>
    <button
      onClick={() => setSuccessMsg(null)}
      className="text-white hover:text-gray-200 transition-colors"
    >
      ✖
    </button>
  </div>
)}

      {error && (
        <div
          style={fadeSlideInStyle("0.05s")}
          className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-center"
        >
          {error}
        </div>
      )}

      <div className="flex flex-col gap-6">
        {/* Profile Picture */}
        <ProfilePictureCard
          profileImage={profile.imageUrl}
          onSelectImage={handleSelectImage}
        />

        <div
          style={fadeSlideInStyle("0.2s")}
          className="rounded-lg shadow-md p-6 border border-[#2D3748] bg-[#222B3A] text-white"
        >
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-semibold">Personal Information</h2>
              <p className="text-gray-400">Update your personal details</p>
            </div>
            {!editMode ? (
              <button
                onClick={() => setEditMode(true)}
                className="text-green-400 hover:text-green-600 font-medium px-3 py-1 border border-green-400 rounded-md hover:bg-green-900/30 transition-colors"
              >
                Edit
              </button>
            ) : (
              <div className="space-x-2">
                <button
                  onClick={() => setEditMode(false)}
                  className="px-3 py-1 text-gray-300 hover:text-white border border-gray-600 rounded-md hover:bg-gray-700/30 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`px-3 py-1 rounded ${
                    saving ? "bg-green-400" : "bg-green-600 hover:bg-green-700"
                  } text-white border border-green-600 transition-colors`}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4 mt-6">
            {/* EDIT MODE: (you can add animation to each field like below if you want) */}
            {editMode ? (
              <>
                <div style={fadeSlideInStyle("0.25s")}>
                  <label className="block text-sm font-medium mb-1 text-gray-300">First Name</label>
                  <input
                    type="text"
                    value={profile.name.split(" ")[0] || ""}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        name:
                          e.target.value +
                          " " +
                          (profile.name.split(" ")[1] || ""),
                      })
                    }
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white"
                  />
                </div>
                <div style={fadeSlideInStyle("0.3s")}>
                  <label className="block text-sm font-medium mb-1 text-gray-300">Last Name</label>
                  <input
                    type="text"
                    value={profile.name.split(" ")[1] || ""}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        name:
                          (profile.name.split(" ")[0] || "") +
                          " " +
                          e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white"
                  />
                </div>
                <div style={fadeSlideInStyle("0.35s")}>
                  <label className="block text-sm font-medium mb-1 text-gray-300">Email</label>
                  <input
                    type="email"
                    value={profile.email}
                    readOnly
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-400 cursor-not-allowed"
                  />
                </div>
                <div style={fadeSlideInStyle("0.4s")}>
                  <label className="block text-sm font-medium mb-1 text-gray-300">Phone Number</label>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white"
                  />
                </div>
                <div style={fadeSlideInStyle("0.45s")}>
                  <label className="block text-sm font-medium mb-1 text-gray-300">
                    Skills (comma separated)
                  </label>
                  <input
                    type="text"
                    name="skills"
                    value={profile.skills}
                    onChange={handleChange}
                    placeholder="e.g. JavaScript, React, Node.js"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white"
                  />
                </div>
                <div style={fadeSlideInStyle("0.5s")}>
                  <label className="block text-sm font-medium mb-1 text-gray-300">
                    Bio (max {BIO_WORD_LIMIT} words)
                  </label>
                  <textarea
                    value={profile.bio}
                    onChange={(e) => {
                      const words = e.target.value.trim().split(/\s+/);
                      if (words.length <= BIO_WORD_LIMIT) {
                        setProfile({ ...profile, bio: e.target.value });
                      }
                    }}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white"
                  />
                  <p className="text-xs text-gray-400 text-right mt-1">
                    {bioWordCount}/{BIO_WORD_LIMIT} words
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* READ-ONLY FIELDS WITH ANIMATION */}
                <div style={fadeSlideInStyle("0.25s")}>
                  <p className="text-sm font-medium mb-1 text-gray-300">
                    First Name
                  </p>
                  <div className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white">
                    {profile.name.split(" ")[0] || "-"}
                  </div>
                </div>

                <div style={fadeSlideInStyle("0.3s")}>
                  <p className="text-sm font-medium mb-1 text-gray-300">
                    Last Name
                  </p>
                  <div className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white">
                    {profile.name.split(" ")[1] || "-"}
                  </div>
                </div>

                <div style={fadeSlideInStyle("0.35s")}>
                  <p className="text-sm font-medium mb-1 text-gray-300">
                    Email
                  </p>
                  <div className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white">
                    {profile.email || "-"}
                  </div>
                </div>

                <div style={fadeSlideInStyle("0.4s")}>
                  <p className="text-sm font-medium mb-1 text-gray-300">
                    Phone Number
                  </p>
                  <div className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white">
                    {profile.phone || "-"}
                  </div>
                </div>

                <div style={fadeSlideInStyle("0.45s")}>
                  <p className="text-sm font-medium mb-1 text-gray-300">
                    Skills
                  </p>
                  <div className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white min-h-[40px]">
                    {profile.skills || "-"}
                  </div>
                </div>

                <div style={fadeSlideInStyle("0.5s")}>
                  <p className="text-sm font-medium mb-1 text-gray-300">
                    Bio (max {BIO_WORD_LIMIT} words)
                  </p>
                  <div className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white min-h-[60px] whitespace-pre-line">
                    {profile.bio || "-"}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}