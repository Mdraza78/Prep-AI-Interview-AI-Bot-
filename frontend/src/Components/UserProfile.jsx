import React, { useEffect, useState, useRef } from "react";

const BIO_WORD_LIMIT = 20;

export default function UserProfile() {
  // Profile state includes image preview and selected file
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    bio: "",
    skills: "",
    imageUrl: "", // URL or base64 preview of profile image
    imageFile: null, // file selected for upload
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const token = localStorage.getItem("token");

  const bioWordCount = profile.bio.trim() === "" ? 0 : profile.bio.trim().split(/\s+/).length;

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
        const res = await fetch("http://localhost:5000/api/user/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load profile");
        const data = await res.json();

        setProfile({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          bio: data.bio || "",
          skills: Array.isArray(data.skills) ? data.skills.join(", ") : data.skills || "",
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

      // TODO: If image uploading is supported separately, handle that here:
      // e.g., upload profile.imageFile with FormData, then update imageUrl from response

      const res = await fetch("http://localhost:5000/api/user/profile", {
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
    return <div className="text-center py-8 text-green-500">Loading profile...</div>;
  if (error)
    return <div className="text-center py-8 text-red-600">Error: {error}</div>;

  // ProfilePictureCard nested component
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
      <div className="rounded-lg shadow-md p-4 border border-[#2D3748] bg-[#222B3A] text-white">
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
                <span className="text-[#c1c9d6] text-2xl">
                  <svg
                    height={34}
                    width={34}
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx={12} cy={8} r={4} fill="#b7bbc0" />
                    <path
                      d="M4.77 19.4C6.37 16.8 9 15 12 15s5.63 1.8 7.23 4.4"
                      stroke="#b7bbc0"
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              )}
            </div>

            <button
              type="button"
              aria-label="Change photo"
              className="absolute -bottom-1 -left-1 bg-green-600 text-white rounded-full border-4 border-[#222B3A] p-1 hover:bg-green-700 transition"
              onClick={() => fileInputRef.current.click()}
              tabIndex={0}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M14.828 5.828a4 4 0 0 0-5.656 0L5.414 9.586A2 2 0 0 0 5 11.414V17a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5.586a2 2 0 0 0-.586-1.414l-3.758-3.758z"></path>
                <path d="M15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"></path>
              </svg>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/gif"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImageChange}
                tabIndex={-1}
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
            <div className="text-xs text-gray-400">JPG, PNG or GIF. Max size 2MB.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 min-h-screen">
     {successMsg && (
  <div className="mb-4 flex items-center justify-between p-4 rounded-lg bg-green-600 text-white shadow relative animate-fade-in">
    <div className="flex items-center gap-2">
      {/* Check Circle Icon */}
      <svg
        className="w-6 h-6 text-white flex-shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        viewBox="0 0 24 24"
      >
        <circle cx={12} cy={12} r={11} stroke="currentColor" strokeWidth={2.5} fill="none" />
        <path d="M7 13l3 3 7-7" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span className="font-semibold">{successMsg}</span>
    </div>
    {/* X Dismiss Button */}
    <button
      onClick={() => setSuccessMsg(null)}
      className="w-6 h-6 flex items-center justify-center rounded hover:bg-green-700 focus:outline-none transition"
      aria-label="Dismiss"
      type="button"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        viewBox="0 0 24 24"
      >
        <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
      </svg>
    </button>
  </div>
)}

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-center">{error}</div>
      )}

      <div className="flex flex-col gap-6">
        <ProfilePictureCard profileImage={profile.imageUrl} onSelectImage={handleSelectImage} />

        <div className="rounded-lg shadow-md p-6 border border-[#2D3748] bg-[#222B3A] text-white">
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
            {editMode ? (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-300">First Name</label>
                  <input
                    type="text"
                    value={profile.name.split(" ")[0] || ""}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        name: e.target.value + " " + (profile.name.split(" ")[1] || ""),
                      })
                    }
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-300">Last Name</label>
                  <input
                    type="text"
                    value={profile.name.split(" ")[1] || ""}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        name: (profile.name.split(" ")[0] || "") + " " + e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-300">Email</label>
                  <input
                    type="email"
                    value={profile.email}
                    readOnly
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-400 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-300">Phone Number</label>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-300">Skills (comma separated)</label>
                  <input
                    type="text"
                    name="skills"
                    value={profile.skills}
                    onChange={handleChange}
                    placeholder="e.g. JavaScript, React, Node.js"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
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
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <p className="text-xs text-gray-400 text-right mt-1">
                    {bioWordCount}/{BIO_WORD_LIMIT} words
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-sm font-medium mb-1 text-gray-300">First Name</p>
                  <div className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white">
                    {profile.name.split(" ")[0] || "-"}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-1 text-gray-300">Last Name</p>
                  <div className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white">
                    {profile.name.split(" ")[1] || "-"}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-1 text-gray-300">Email</p>
                  <div className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white">
                    {profile.email || "-"}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-1 text-gray-300">Phone Number</p>
                  <div className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white">
                    {profile.phone || "-"}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-1 text-gray-300">Skills</p>
                  <div className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white min-h-[40px]">
                    {profile.skills || "-"}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-1 text-gray-300">Bio (max {BIO_WORD_LIMIT} words)</p>
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
